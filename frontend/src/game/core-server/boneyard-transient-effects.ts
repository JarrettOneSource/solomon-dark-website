import type {
  BoneyardEnemyDeathEffect,
  BoneyardEnemyProjectileEffect,
} from './boneyard-enemy-store.ts'
import type { RegisterNativeWorldPainter } from '../core-kernels/native-world-manager-order.ts'

interface BoneyardTransientPrograms {
  readonly poisonPoolAlphaLossPerTick: number
}

interface BoneyardTransientStepResult {
  readonly deathEffects: BoneyardEnemyDeathEffect[]
  readonly nextDeathEffectId: number
  readonly projectileEffects: BoneyardEnemyProjectileEffect[]
}

export function stepBoneyardTransientEffects(
  deathEffects: readonly BoneyardEnemyDeathEffect[],
  projectileEffects: readonly BoneyardEnemyProjectileEffect[],
  tick: number,
  drawUnit: () => number,
  nextDeathEffectId: number,
  registerWorldPainter: RegisterNativeWorldPainter,
  programs: BoneyardTransientPrograms,
): BoneyardTransientStepResult {
  const death = stepDeathEffects(
    deathEffects,
    tick,
    drawUnit,
    nextDeathEffectId,
    registerWorldPainter,
  )
  return {
    deathEffects: death.effects,
    nextDeathEffectId: death.nextDeathEffectId,
    projectileEffects: stepProjectileEffects(projectileEffects, tick, programs),
  }
}

interface DeathPopulationStep {
  readonly effects: BoneyardEnemyDeathEffect[]
  readonly nextDeathEffectId: number
}

export function stepBornBoneyardBouncer(
  effect: BoneyardEnemyDeathEffect,
  tick: number,
  drawUnit: () => number,
  nextDeathEffectId: number,
  registerWorldPainter: RegisterNativeWorldPainter,
): DeathPopulationStep {
  if (effect.kind !== 'bouncer' && effect.kind !== 'smoky-bouncer') {
    throw new Error('only a Bouncer can run the native immediate birth tick')
  }
  if (effect.spawnTick !== tick || effect.lastStepTick !== tick) {
    throw new Error('Bouncer birth tick must match its authoritative clock')
  }
  const stepped = stepDeathEffect(effect, tick, drawUnit, true)
  if (stepped === null) return { effects: [], nextDeathEffectId }
  const effects = [stepped]
  if (
    stepped.kind === 'smoky-bouncer'
    && stepped.height < 0
    && drawInteger(drawUnit, 3) === 1
  ) {
    effects.push(smokyBouncerBirth(
      stepped,
      tick,
      nextDeathEffectId,
      drawUnit,
      registerWorldPainter,
    ))
    nextDeathEffectId += 1
  }
  return { effects, nextDeathEffectId }
}

function stepDeathEffects(
  source: readonly BoneyardEnemyDeathEffect[],
  tick: number,
  drawUnit: () => number,
  firstDeathEffectId: number,
  registerWorldPainter: RegisterNativeWorldPainter,
): DeathPopulationStep {
  if (source.length === 0) {
    return { effects: [], nextDeathEffectId: firstDeathEffectId }
  }
  let effects = [...source]
  let nextDeathEffectId = firstDeathEffectId
  const firstStepTick = Math.min(...effects.map(({ lastStepTick }) => lastStepTick)) + 1
  for (let stepTick = firstStepTick; stepTick <= tick; stepTick += 1) {
    const retained: BoneyardEnemyDeathEffect[] = []
    const births: BoneyardEnemyDeathEffect[] = []
    for (const effect of effects) {
      if (effect.lastStepTick >= stepTick) {
        retained.push(effect)
        continue
      }
      const stepped = stepDeathEffect(effect, stepTick, drawUnit)
      if (stepped === null) continue
      retained.push(stepped)
      if (
        stepped.kind === 'smoky-bouncer'
        && stepped.height < 0
        && drawInteger(drawUnit, 3) === 1
      ) {
        births.push(smokyBouncerBirth(
          stepped,
          stepTick,
          nextDeathEffectId,
          drawUnit,
          registerWorldPainter,
        ))
        nextDeathEffectId += 1
      }
    }
    effects = [...retained, ...births]
  }
  return { effects, nextDeathEffectId }
}

function stepDeathEffect(
  source: BoneyardEnemyDeathEffect,
  tick: number,
  drawUnit: () => number,
  updateAtBirth = false,
): BoneyardEnemyDeathEffect | null {
  if (tick < source.spawnTick || (tick === source.spawnTick && !updateAtBirth)) {
    const waiting = cloneDeathEffect(source)
    waiting.ageTicks = 0
    waiting.lastStepTick = tick
    return waiting
  }
  const ageTicks = Math.max(0, tick - source.spawnTick)
  if (ageTicks >= source.lifetimeTicks) return null

  if (source.kind === 'bouncer' || source.kind === 'smoky-bouncer') {
    const skipsAirborneMotion = source.height < 0 && tick % 3 === 0
    const position = skipsAirborneMotion
      ? source.position
      : {
          x: source.position.x + source.velocity.x,
          y: source.position.y + source.velocity.y,
        }
    let velocityX = source.velocity.x
    let velocityY = source.velocity.y
    let height = skipsAirborneMotion
      ? source.height
      : source.height + source.verticalVelocity
    let verticalVelocity = skipsAirborneMotion
      ? source.verticalVelocity
      : source.verticalVelocity + 0.4
    let bounceVelocity = source.bounceVelocity
    let angularVelocityDeg = source.angularVelocityDeg
    const rotationDeg = skipsAirborneMotion
      ? source.rotationDeg
      : source.rotationDeg + angularVelocityDeg
    const opacityTimer = skipsAirborneMotion
      ? source.opacityTimer
      : source.opacityTimer - source.alphaLossPerTick
    if (!skipsAirborneMotion && height >= 0) {
      height = 0
      bounceVelocity *= source.bounceRetention
      verticalVelocity = bounceVelocity
      angularVelocityDeg = 1 + drawUnit() * 10
      if (drawUnit() < 0.5) {
        velocityX *= source.bounceRetention
        velocityY *= source.bounceRetention
      }
      if (verticalVelocity > -0.75) {
        verticalVelocity = 0
        angularVelocityDeg = 0
        velocityX = 0
        velocityY = 0
      }
      height = verticalVelocity
    }
    if (opacityTimer <= 0) return null
    const bounced = cloneDeathEffect(source)
    bounced.ageTicks = ageTicks
    bounced.alpha = Math.min(1, opacityTimer)
    bounced.angularVelocityDeg = angularVelocityDeg
    bounced.bounceVelocity = bounceVelocity
    bounced.height = height
    bounced.lastStepTick = tick
    bounced.opacityTimer = opacityTimer
    bounced.position = position
    bounced.rotationDeg = rotationDeg
    bounced.verticalVelocity = verticalVelocity
    bounced.velocity = { x: velocityX, y: velocityY }
    return bounced
  }

  const opacityTimer = source.opacityTimer - source.alphaLossPerTick
  if (opacityTimer <= 0) return null
  let entry = source.entry
  let framePhase = source.framePhase
  let frameVelocity = source.frameVelocity
  let position = source.position
  let scale = source.scale
  let velocity = source.velocity
  switch (source.kind) {
    case 'move-fade':
      position = {
        x: source.position.x + source.velocity.x,
        y: source.position.y + source.velocity.y,
      }
      velocity = {
        x: source.velocity.x * source.velocityDamping,
        y: source.velocity.y * source.velocityDamping,
      }
      break
    case 'sprite-array': {
      framePhase += frameVelocity
      if (framePhase > source.frameCount) return null
      frameVelocity *= source.frameVelocityDamping
      entry = source.firstEntry + Math.min(
        source.frameCount - 1,
        Math.max(0, Math.trunc(framePhase)),
      )
      if (source.velocity.x !== 0 || source.velocity.y !== 0) {
        position = {
          x: source.position.x + source.velocity.x,
          y: source.position.y + source.velocity.y,
        }
      }
      break
    }
    case 'fire-array':
      entry = 46 + positiveModulo(
        source.firstEntry - 46 + Math.floor(ageTicks / source.frameTicks),
        32,
      )
      break
    case 'fade-scale':
      scale *= source.scaleMultiplier
      break
    case 'banish':
    case 'fade':
    case 'fade-additive':
    case 'fade-perspective':
    case 'fade-perspective-clipped':
    case 'late-splat':
    case 'unbind':
      break
    default:
      assertNever(source.kind)
  }
  const faded = cloneDeathEffect(source)
  faded.ageTicks = ageTicks
  faded.alpha = deathEffectAlpha(source.kind, opacityTimer, source.alphaMultiplier)
  faded.entry = entry
  faded.framePhase = framePhase
  faded.frameVelocity = frameVelocity
  faded.lastStepTick = tick
  faded.opacityTimer = opacityTimer
  faded.position = position
  faded.rotationDeg = source.rotationDeg + source.angularVelocityDeg
  faded.scale = scale
  faded.velocity = velocity
  return faded
}

type MutableDeathEffect = {
  -readonly [Key in keyof BoneyardEnemyDeathEffect]: BoneyardEnemyDeathEffect[Key]
}

/**
 * Explicit field-by-field copy in the spawn-site key order. Spawned records
 * are frozen, and V8 falls off its fast object-spread path for frozen
 * sources, so `{ ...source }` costs several times more than this literal for
 * the ~130 death effects stepped every tick. The property order matches the
 * spawn literals, so stepped rows serialize identically to spread rows.
 */
function cloneDeathEffect(source: BoneyardEnemyDeathEffect): MutableDeathEffect {
  return {
    ageTicks: source.ageTicks,
    alpha: source.alpha,
    alphaMultiplier: source.alphaMultiplier,
    alphaLossPerTick: source.alphaLossPerTick,
    angularVelocityDeg: source.angularVelocityDeg,
    atlas: source.atlas,
    blendMode: source.blendMode,
    bounceRetention: source.bounceRetention,
    bounceVelocity: source.bounceVelocity,
    entry: source.entry,
    firstEntry: source.firstEntry,
    frameCount: source.frameCount,
    framePhase: source.framePhase,
    frameVelocity: source.frameVelocity,
    frameVelocityDamping: source.frameVelocityDamping,
    frameTicks: source.frameTicks,
    height: source.height,
    id: source.id,
    kind: source.kind,
    lastStepTick: source.lastStepTick,
    lifetimeTicks: source.lifetimeTicks,
    opacityTimer: source.opacityTimer,
    ownerActorId: source.ownerActorId,
    painterRegistration: source.painterRegistration,
    presentationOwner: source.presentationOwner,
    position: source.position,
    role: source.role,
    rotationDeg: source.rotationDeg,
    scale: source.scale,
    scaleMultiplier: source.scaleMultiplier,
    shadow: source.shadow,
    spawnTick: source.spawnTick,
    tint: source.tint,
    verticalVelocity: source.verticalVelocity,
    velocity: source.velocity,
    velocityDamping: source.velocityDamping,
  }
}

function deathEffectAlpha(
  kind: BoneyardEnemyDeathEffect['kind'],
  opacityTimer: number,
  multiplier: number,
): number {
  if (kind === 'fade' || kind === 'unbind') return opacityTimer * multiplier
  const timerAlpha = kind === 'late-splat'
    ? Math.min(1, opacityTimer * 0.25)
    : Math.min(1, opacityTimer)
  return timerAlpha * multiplier
}

function smokyBouncerBirth(
  owner: BoneyardEnemyDeathEffect,
  tick: number,
  id: number,
  drawUnit: () => number,
  registerWorldPainter: RegisterNativeWorldPainter,
): BoneyardEnemyDeathEffect {
  const radius = drawUnit() * 10
  const offset = radialVector(drawUnit() * 360, radius)
  const rotationDeg = drawUnit() * 360
  const scale = 0.1 + drawUnit() * 0.25
  const opacityTimer = 0.25 + drawUnit() * 0.45
  return {
    ageTicks: 0,
    alpha: opacityTimer,
    alphaMultiplier: 1,
    alphaLossPerTick: 0.01,
    angularVelocityDeg: 0,
    atlas: 'BadGuys',
    blendMode: 'add',
    bounceRetention: 0,
    bounceVelocity: 0,
    entry: 10,
    firstEntry: 10,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: 0,
    id,
    kind: 'fade-additive',
    lastStepTick: tick,
    lifetimeTicks: Math.ceil(opacityTimer / 0.01),
    opacityTimer,
    ownerActorId: owner.ownerActorId,
    painterRegistration: registerWorldPainter('actor'),
    presentationOwner: 'world-sorted',
    position: {
      x: owner.position.x + offset.x,
      y: owner.position.y + offset.y,
    },
    role: `${owner.role}:smoke`,
    rotationDeg,
    scale,
    scaleMultiplier: 1,
    shadow: false,
    spawnTick: tick,
    tint: 0xbebf8f,
    verticalVelocity: 0,
    velocity: { x: 0, y: 0 },
    velocityDamping: 1,
  }
}

function drawInteger(drawUnit: () => number, count: number): number {
  return Math.min(count - 1, Math.floor(drawUnit() * count))
}

function radialVector(angleDeg: number, magnitude: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180
  return { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
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
