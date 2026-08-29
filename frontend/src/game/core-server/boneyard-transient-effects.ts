import type {
  BoneyardEnemyDeathEffect,
  BoneyardEnemyProjectileEffect,
} from './boneyard-enemy-store.ts'

interface BoneyardTransientPrograms {
  readonly poisonPoolAlphaLossPerTick: number
}

interface BoneyardTransientStepResult {
  readonly deathEffects: BoneyardEnemyDeathEffect[]
  readonly projectileEffects: BoneyardEnemyProjectileEffect[]
}

export function stepBoneyardTransientEffects(
  deathEffects: readonly BoneyardEnemyDeathEffect[],
  projectileEffects: readonly BoneyardEnemyProjectileEffect[],
  tick: number,
  drawUnit: () => number,
  programs: BoneyardTransientPrograms,
): BoneyardTransientStepResult {
  return {
    deathEffects: stepDeathEffects(deathEffects, tick, drawUnit),
    projectileEffects: stepProjectileEffects(projectileEffects, tick, programs),
  }
}

function stepDeathEffects(
  source: readonly BoneyardEnemyDeathEffect[],
  tick: number,
  drawUnit: () => number,
): BoneyardEnemyDeathEffect[] {
  const retained: BoneyardEnemyDeathEffect[] = []
  for (const original of source) {
    let effect: BoneyardEnemyDeathEffect | null = original
    for (let stepTick = original.lastStepTick + 1; stepTick <= tick; stepTick += 1) {
      effect = stepDeathEffect(effect, stepTick, drawUnit)
      if (effect === null) break
    }
    if (effect !== null) retained.push(effect)
  }
  return retained
}

function stepDeathEffect(
  source: BoneyardEnemyDeathEffect,
  tick: number,
  drawUnit: () => number,
): BoneyardEnemyDeathEffect | null {
  if (tick <= source.spawnTick) {
    return { ...source, ageTicks: 0, lastStepTick: tick }
  }
  const ageTicks = Math.max(0, tick - source.spawnTick)
  if (ageTicks >= source.lifetimeTicks) return null

  if (source.kind === 'bouncer') {
    if (source.height < 0 && tick % 3 === 0) {
      return { ...source, ageTicks, lastStepTick: tick }
    }
    const position = {
      x: source.position.x + source.velocity.x,
      y: source.position.y + source.velocity.y,
    }
    let velocityX = source.velocity.x
    let velocityY = source.velocity.y
    let height = source.height + source.verticalVelocity
    let verticalVelocity = source.verticalVelocity + 0.4
    let bounceVelocity = source.bounceVelocity
    let angularVelocityDeg = source.angularVelocityDeg
    const rotationDeg = source.rotationDeg + angularVelocityDeg
    const opacityTimer = source.opacityTimer - source.alphaLossPerTick
    if (height >= 0) {
      height = 0
      bounceVelocity *= 0.65
      verticalVelocity = bounceVelocity
      if (drawUnit() < 0.5) {
        velocityX *= 0.65
        velocityY *= 0.65
      }
      if (verticalVelocity > -0.75) {
        verticalVelocity = 0
        angularVelocityDeg = 0
        velocityX = 0
        velocityY = 0
      }
    }
    if (opacityTimer <= 0) return null
    return {
      ...source,
      ageTicks,
      alpha: Math.min(1, opacityTimer),
      angularVelocityDeg,
      bounceVelocity,
      height,
      lastStepTick: tick,
      opacityTimer,
      position,
      rotationDeg,
      verticalVelocity,
      velocity: { x: velocityX, y: velocityY },
    }
  }

  const opacityTimer = source.opacityTimer - source.alphaLossPerTick
  if (opacityTimer <= 0) return null
  let moves = false
  switch (source.kind) {
    case 'move-fade':
      moves = true
      break
    case 'sprite-array':
      moves = source.velocity.x !== 0 || source.velocity.y !== 0
      break
    case 'banish':
    case 'fade':
    case 'fire-array':
    case 'unbind':
      break
    default:
      assertNever(source.kind)
  }
  const position = moves
    ? {
        x: source.position.x + source.velocity.x,
        y: source.position.y + source.velocity.y,
      }
    : source.position
  const frame = Math.min(
    source.frameCount - 1,
    Math.floor(ageTicks / source.frameTicks),
  )
  const entry = source.kind === 'sprite-array'
    ? source.firstEntry + frame
    : source.kind === 'fire-array'
      ? 46 + positiveModulo(source.firstEntry - 46 + frame, 32)
      : source.entry
  return {
    ...source,
    ageTicks,
    alpha: opacityTimer,
    entry,
    lastStepTick: tick,
    opacityTimer,
    position,
    rotationDeg: source.rotationDeg + source.angularVelocityDeg,
    scale: source.kind === 'banish' ? source.scale * 1.025 : source.scale,
  }
}

function stepProjectileEffects(
  source: readonly BoneyardEnemyProjectileEffect[],
  tick: number,
  programs: BoneyardTransientPrograms,
): BoneyardEnemyProjectileEffect[] {
  const retained: BoneyardEnemyProjectileEffect[] = []
  for (const effect of source) {
    const elapsedTicks = tick - effect.lastStepTick
    if (elapsedTicks <= 0) {
      retained.push(effect)
      continue
    }
    const ageTicks = effect.ageTicks + elapsedTicks
    if (ageTicks >= effect.lifetimeTicks) continue
    let alpha = effect.alpha - effect.alphaLossPerTick * elapsedTicks
    let entry = effect.entry
    let position = effect.position
    let rotationDeg = effect.rotationDeg + effect.angularVelocityDeg * elapsedTicks
    let velocity = effect.velocity

    if (effect.kind === 'arrow-tumble') {
      alpha = effect.alpha
      position = effect.position
      rotationDeg = effect.rotationDeg
      velocity = effect.velocity
      for (let step = 0; step < elapsedTicks; step += 1) {
        alpha = Math.fround(alpha - Math.fround(0.1))
        position = {
          x: Math.fround(position.x + velocity.x),
          y: Math.fround(position.y + velocity.y),
        }
        rotationDeg = Math.fround(rotationDeg + effect.angularVelocityDeg)
        velocity = {
          x: Math.fround(velocity.x * Math.fround(0.98)),
          y: Math.fround(velocity.y * Math.fround(0.98)),
        }
      }
    } else {
      switch (effect.kind) {
        case 'fire-burst-frame':
          entry = 251 + Math.min(3, Math.floor(ageTicks / 4))
          break
        case 'demon-fire':
          entry = 46 + positiveModulo(
            Math.floor(effect.phaseOriginTicks + ageTicks * 0.25),
            32,
          )
          break
        case 'poison-pool-fade-inner': {
          const fade = Math.max(
            0,
            1 - ageTicks * programs.poisonPoolAlphaLossPerTick,
          )
          alpha = (Math.sin(
            (effect.phaseOriginTicks + ageTicks) * Math.PI / 180,
          ) * 0.25 + 0.75) * fade
          break
        }
        case 'poison-pool-fade-outer':
          alpha = 0.5 * Math.max(
            0,
            1 - ageTicks * programs.poisonPoolAlphaLossPerTick,
          )
          break
        case 'firebolt-trail':
        case 'fire-burst-glow':
        case 'guided-impact-aura-one':
        case 'guided-impact-aura-two':
        case 'guided-impact-main':
          break
        default:
          assertNever(effect.kind)
      }
      if (effect.velocity.x !== 0 || effect.velocity.y !== 0) {
        position = {
          x: effect.position.x + effect.velocity.x * elapsedTicks,
          y: effect.position.y + effect.velocity.y * elapsedTicks,
        }
      }
    }
    if (alpha <= 0) continue
    retained.push({
      ...effect,
      ageTicks,
      alpha,
      entry,
      lastStepTick: tick,
      position,
      rotationDeg,
      velocity,
    })
  }
  return retained
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Boneyard transient kind: ${String(value)}`)
}
