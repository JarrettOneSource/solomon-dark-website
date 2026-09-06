import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import { drawNativeFloat, drawNativeSign } from '../../core-kernels/native-rng.ts'
import type {
  NativeWorldManagerRegistration,
  RegisterNativeWorldPainter,
} from '../../core-kernels/native-world-manager-order.ts'
import { createNativeWorldManagerOrder } from '../../core-kernels/native-world-manager-order.ts'
import { emitEvent } from './events.ts'
import type {
  BoneyardEnemyProjectile,
  BoneyardEnemyProjectileEffect,
  BoneyardEnemyProjectileEffectBase,
  BoneyardEnemyProjectileEffectKind,
  BoneyardEnemyProjectileId,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
  TumbleBoneyardArrowResult,
  WorkingStep,
} from './model.ts'
import { validateTick } from './model.ts'
import { NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS } from './programs.ts'
import { drawEnemyFloat, drawEnemySign } from './random.ts'
import { standaloneEnemyWorldManagerOrderState } from './registration.ts'

export function setBoneyardArrowChillTumbleAccumulator(
  source: BoneyardEnemyStore,
  projectileId: BoneyardEnemyProjectileId,
  accumulator: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(accumulator) || accumulator < 0 || accumulator > 1) {
    throw new RangeError('Arrow Chill accumulator must be finite and within [0,1]')
  }
  const projectileIndex = source.projectiles.findIndex(({ id }) => id === projectileId)
  const projectile = source.projectiles[projectileIndex]
  if (!projectile || projectile.kind !== 'arrow') return source
  const projectiles = [...source.projectiles]
  projectiles[projectileIndex] = { ...projectile, chillTumbleAccumulator: accumulator }
  return { ...source, projectiles }
}

/**
 * Arrow::vslot+0x64 removes the projectile once Chill Wind crosses its tumble
 * threshold, then transfers record 2 into one world-owned Anim_SpinAway.
 * The two Float calls plus the signed-direction word stay on combat RNG.
 */
export function tumbleBoneyardArrow(
  source: BoneyardEnemyStore,
  projectileId: BoneyardEnemyProjectileId,
  direction: Readonly<BoneyardPoint>,
  tick: number,
  sourceRng: NativeRngState,
  registerWorldPainter?: RegisterNativeWorldPainter,
): TumbleBoneyardArrowResult {
  validateTick(tick)
  if (tick < source.lastStepTick) {
    throw new RangeError('arrow tumble tick must not precede the store clock')
  }
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y)) {
    throw new RangeError('arrow tumble direction must be finite')
  }
  const length = Math.hypot(direction.x, direction.y)
  if (!(length > 0)) {
    throw new RangeError('arrow tumble direction must be nonzero')
  }
  const index = source.projectiles.findIndex(({ id }) => id === projectileId)
  const projectile = source.projectiles[index]
  if (!projectile || projectile.kind !== 'arrow') {
    return { events: [], rng: sourceRng, store: source, tumbled: false }
  }

  const rotation = drawNativeFloat(sourceRng, 360)
  const angularMagnitude = drawNativeFloat(rotation.state, 10)
  const angularVelocity = drawNativeSign(
    angularMagnitude.state,
    Math.fround(10 + angularMagnitude.value),
  )
  const projectiles = [...source.projectiles]
  projectiles.splice(index, 1)
  const effect: BoneyardEnemyProjectileEffect = Object.freeze({
    ageTicks: 0,
    alpha: Math.fround(4),
    alphaLossPerTick: Math.fround(0.1),
    angularVelocityDeg: angularVelocity.value,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 2,
    id: source.nextProjectileEffectId,
    kind: 'arrow-tumble',
    lastStepTick: tick,
    lightRegistration: null,
    lifetimeTicks: 41,
    ownerActorId: projectile.ownerActorId,
    ownerProjectileId: projectile.id,
    painterRegistration: (
      registerWorldPainter
      ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register
    )('actor'),
    phaseOriginTicks: projectile.ageTicks,
    position: Object.freeze({ ...projectile.position }),
    rotationDeg: rotation.value,
    scale: 1,
    spawnTick: tick,
    tint: 0xffffff,
    velocity: Object.freeze({
      x: Math.fround(direction.x / length),
      y: Math.fround(direction.y / length),
    }),
  })
  const event: BoneyardEnemySemanticEvent = Object.freeze({
    actorId: projectile.ownerActorId,
    eventId: source.nextEventId,
    projectileId: projectile.id,
    targetPlayerId: null,
    tick,
    type: 'projectile-retired',
  })
  return {
    events: Object.freeze([event]),
    rng: angularVelocity.state,
    store: {
      ...source,
      nextEventId: source.nextEventId + 1,
      nextProjectileEffectId: source.nextProjectileEffectId + 1,
      projectileEffects: Object.freeze([...source.projectileEffects, effect]),
      projectiles: Object.freeze(projectiles),
    },
    tumbled: true,
  }
}

interface SpawnProjectileEffectOptions {
  readonly alpha?: number
  readonly alphaLossPerTick?: number
  readonly angularVelocityDeg?: number
  readonly atlas?: BoneyardEnemyProjectileEffect['atlas']
  readonly blendMode?: BoneyardEnemyProjectileEffect['blendMode']
  readonly entry: number
  readonly lifetimeTicks: number
  readonly lightRegistration?: NativeWorldManagerRegistration
  readonly painterRegistration?: NativeWorldManagerRegistration
  readonly phaseOriginTicks?: number
  readonly rotationDeg?: number
  readonly scale?: number
  readonly tint?: number
  readonly velocity?: Readonly<BoneyardPoint>
}

export function createProjectileEffect<Kind extends BoneyardEnemyProjectileEffectKind>(
  work: WorkingStep,
  projectile: Pick<BoneyardEnemyProjectile, 'id' | 'ownerActorId' | 'ageTicks'>,
  tick: number,
  position: Readonly<BoneyardPoint>,
  kind: Kind,
  options: SpawnProjectileEffectOptions,
): BoneyardEnemyProjectileEffectBase & { readonly kind: Kind } {
  const id = work.nextProjectileEffectId++
  return Object.freeze({
    ageTicks: 0,
    alpha: options.alpha ?? 1,
    alphaLossPerTick: options.alphaLossPerTick ?? 0,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas ?? 'BadGuys',
    blendMode: options.blendMode ?? 'normal',
    entry: options.entry,
    id,
    kind,
    lastStepTick: tick,
    lightRegistration: options.lightRegistration ?? null,
    lifetimeTicks: options.lifetimeTicks,
    ownerActorId: projectile.ownerActorId,
    ownerProjectileId: projectile.id,
    painterRegistration: options.painterRegistration ?? options.lightRegistration
      ?? work.registerProjectileWorldPainter(
        kind === 'fire-burst' || kind === 'guided-impact' ? 'transient' : 'actor',
      ),
    phaseOriginTicks: options.phaseOriginTicks ?? projectile.ageTicks,
    position: Object.freeze({ ...position }),
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale ?? 1,
    spawnTick: tick,
    tint: options.tint ?? 0xffffff,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
  })
}

export function spawnProjectileTrails(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  end: Readonly<BoneyardPoint>,
  movementTicks: number,
  maximumProgress: number,
): void {
  if (movementTicks <= 0 || projectile.kind !== 'firebolt') return
  for (let offset = 1; offset <= movementTicks; offset += 1) {
    const progress = offset / movementTicks
    if (progress > maximumProgress) break
    const tick = projectile.lastStepTick + offset
    if (tick % NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireboltTrailCadenceTicks !== 0) {
      continue
    }
    const position = Object.freeze({
      x: projectile.position.x + (end.x - projectile.position.x) * progress,
      y: projectile.position.y + (end.y - projectile.position.y) * progress,
    })
    const jitterMagnitude = drawEnemyFloat(work, 5)
    const jitterHeading = drawEnemyFloat(work, 360) * Math.PI / 180
    const alphaLossPerTick = Math.fround(Math.fround(0.1) * (1.5 + drawEnemyFloat(work, 0.5)))
    work.projectileEffects.push(createProjectileEffect(work, projectile, tick, {
      x: position.x + Math.sin(jitterHeading) * jitterMagnitude,
      y: position.y - 15 - Math.cos(jitterHeading) * jitterMagnitude,
    }, 'firebolt-trail', {
      painterRegistration: projectile.painterRegistration,
      blendMode: 'add',
      alphaLossPerTick,
      entry: 255 + (projectile.ageTicks + offset) % 12,
      lifetimeTicks: 8,
      phaseOriginTicks: projectile.ageTicks + offset,
      rotationDeg: projectile.headingDeg + 180,
      scale: Math.fround(0.75 + drawEnemyFloat(work, 0.25)),
    }))
  }
}

export function spawnFireBurst(
  work: WorkingStep,
  projectile: Pick<BoneyardEnemyProjectile, 'id' | 'ownerActorId' | 'ageTicks'>,
  tick: number,
  position: Readonly<BoneyardPoint>,
  scaleBase: number,
  scaleRange = .1,
): void {
  emitEvent(work, tick, 'enemy-action-sound', projectile.ownerActorId, {
    gainScale: 1, pitch: 2, sound: 'fireball-hit', sourcePosition: position,
  })
  const rotationDeg = drawEnemyFloat(work, 360)
  const angularMagnitude = Math.fround(0.5 + drawEnemyFloat(work, 1))
  const angularVelocityDeg = drawEnemySign(work, angularMagnitude)
  const scale = Math.fround(scaleBase + drawEnemyFloat(work, scaleRange, true))
  work.projectileEffects.push(createProjectileEffect(work, projectile, tick, {
    x: position.x, y: Math.fround(position.y - 10),
  }, 'fire-burst', {
    alpha: 0.5,
    alphaLossPerTick: 0.5 / NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    angularVelocityDeg, blendMode: 'add', entry: 251,
    lightRegistration: work.registerProjectileWorldPainter('transient'),
    lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    rotationDeg, scale, velocity: { x: 0, y: -1 },
  }))
}

export function spawnProjectileImpactEffects(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
): void {
  switch (projectile.kind) {
    case 'arrow':
      if (projectile.payload === 'fire') {
        spawnFireBurst(work, projectile, tick, position, 0.5)
      }
      return
    case 'firebolt':
      spawnFireBurst(work, projectile, tick, position, 0.75)
      return
    case 'guided-missile': {
      emitEvent(work, tick, 'enemy-action-sound', projectile.ownerActorId, {
        gainScale: 1, pitch: Math.fround(1 + drawEnemyFloat(work, 0.1)),
        sound: 'magic-missile-hit', sourcePosition: position,
      })
      work.projectileEffects.push(createProjectileEffect(work, projectile, tick, position, 'guided-impact', {
        alpha: 2,
        alphaLossPerTick: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedImpactAlphaLossPerTick,
        blendMode: 'add', entry: projectile.payload === 'cold' ? 110 : 111,
        lightRegistration: work.registerProjectileWorldPainter('transient'),
        lifetimeTicks: 20, rotationDeg: drawEnemyFloat(work, 360), scale: 2,
        tint: projectile.payload === 'cold' ? 0x4080ff : 0x40ff40,
      }))
      return
    }
    case 'demon-bomb': return
    case 'poison-pool': return
  }
}
