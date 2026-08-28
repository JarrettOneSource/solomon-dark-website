import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import type { NativeEnemySampleAtlas } from './native-enemy-animation.ts'

export interface NativeEnemyProjectileLayer {
  readonly alpha: number
  readonly atlas: NativeEnemySampleAtlas
  readonly blendMode: 'add' | 'normal'
  readonly entry: number
  readonly offset: Readonly<{ x: number; y: number }>
  readonly role: string
  readonly rotationRadians: number
  readonly scale: number
  readonly scaleY: number
  readonly tint: number
}

export interface NativeEnemyProjectilePlan {
  readonly layers: readonly NativeEnemyProjectileLayer[]
  readonly position: Readonly<{ x: number; y: number }>
}

/**
 * Projects the retail projectile compositor from authoritative fixed-tick
 * state. `tick` is the host world tick; no layer owns a renderer-local clock.
 */
export function nativeEnemyProjectilePlan(
  projectile: BoneyardEnemyProjectileSnapshot,
  tick: number,
): NativeEnemyProjectilePlan {
  if (!Number.isFinite(tick) || tick < 0) {
    throw new Error('enemy projectile presentation tick must be finite and non-negative')
  }
  const fixedTick = Math.floor(tick)
  const age = Math.max(0, Math.floor(projectile.ageTicks))
  const headingRadians = projectile.headingDeg * Math.PI / 180
  switch (projectile.kind) {
    case 'arrow': {
      const payload = requirePayload(projectile, ['normal', 'fire', 'poison'])
      const visualHeadingRadians = projectile.visualPhaseDeg * Math.PI / 180
      const alpha = Math.min(1, projectile.visualScale)
      const body = layer('BadGuys', 2, `arrow-${payload}`, {
        alpha,
        offset: { x: 0, y: projectile.verticalOffset },
        rotationRadians: visualHeadingRadians,
        scale: 1.25,
      })
      if (payload === 'normal') return plan(projectile, [body])
      const heightScale = projectile.verticalOffset === 0 ? 0.35 : 1
      const overlayScale = 0.5
        + deterministicUnit(projectile.id, fixedTick, 0) * 0.5 * heightScale
      const overlay = payload === 'fire'
        ? layer('BadGuys', 255 + Math.floor(fixedTick / 5) % 12, 'arrow-fire-overlay', {
            alpha,
            blendMode: 'add',
            offset: { x: 0, y: projectile.verticalOffset },
            rotationRadians: visualHeadingRadians + Math.PI,
            scale: overlayScale,
          })
        : layer('BadGuys', 271 + Math.floor(age / 6) % 12, 'arrow-poison-overlay', {
            alpha,
            blendMode: 'add',
            offset: { x: 0, y: projectile.verticalOffset },
            rotationRadians: visualHeadingRadians + Math.PI,
            scale: overlayScale,
            tint: 0x008000,
          })
      return plan(projectile, [body, overlay])
    }
    case 'firebolt': {
      requirePayload(projectile, ['fire'])
      const alpha = remainingLifetimeAlpha(projectile, age)
      const entry = 255 + age % 12
      return plan(projectile, [
        layer('BadGuys', 15, 'firebolt-orange-glow', {
          alpha: alpha * 0.5,
          blendMode: 'add',
          offset: { x: 0, y: -15 },
          scale: 2,
          tint: 0xff8000,
        }),
        layer('BadGuys', entry, 'firebolt-body', {
          alpha,
          blendMode: 'add',
          offset: { x: 0, y: -15 },
          rotationRadians: headingRadians + Math.PI,
          scale: 1 + deterministicUnit(projectile.id, fixedTick, 1) * 0.5,
        }),
      ])
    }
    case 'guided-missile': {
      const payload = requirePayload(projectile, ['cold', 'poison'])
      const lifetimeAlpha = remainingLifetimeAlpha(projectile, age)
      const phase = projectile.visualPhaseDeg
      const mainEntry = payload === 'cold' ? 110 : 111
      const auraTint = payload === 'cold' ? 0x4080ff : 0x40ff40
      return plan(projectile, [
        layer('BadGuys', mainEntry, `guided-missile-${payload}-body`, {
          alpha: lifetimeAlpha * (
            0.5 + deterministicUnit(projectile.id, fixedTick, 0) * 0.5
          ),
          blendMode: 'add',
          offset: { x: 0, y: -15 },
          scale: 1.1
            + Math.abs(sinDegrees(phase * 15)) * 0.15 * projectile.visualScale,
        }),
        layer('BadGuys', 112, `guided-missile-${payload}-aura`, {
          alpha: lifetimeAlpha * Math.abs(sinDegrees(phase * 6)) * 0.55,
          blendMode: 'add',
          offset: { x: 0, y: -15 },
          rotationRadians: phase * 0.5 * Math.PI / 180,
          scale: (1 + deterministicUnit(projectile.id, fixedTick, 1) * 0.3)
            * projectile.visualScale,
          tint: auraTint,
        }),
      ])
    }
    case 'demon-bomb': {
      requirePayload(projectile, ['none'])
      const bombLayers = Array.from({ length: 3 }, (_, index) => layer(
        'BadGuys',
        267 + deterministicDomainSample(projectile.id, fixedTick, index, 4),
        `demon-bomb-sample-${index}`,
        {
          blendMode: index === 0 ? 'normal' : 'add',
          offset: { x: 0, y: projectile.verticalOffset },
          scale: index < 2 ? 2 : 1.5,
        },
      ))
      if (projectile.speed > 2) return plan(projectile, bombLayers)
      const groundAlpha = projectile.speed <= 1
        ? 1
        : Math.max(0, 1 - projectile.speed * 0.5)
      return plan(projectile, [...bombLayers, layer(
        'DeadHawg',
        46 + Math.floor(fixedTick / 2) % 32,
        'demon-bomb-ground',
        {
          alpha: groundAlpha,
          blendMode: 'add',
          offset: { x: 0, y: -20 },
          scaleY: 0.5,
        },
      )])
    }
    case 'poison-pool': {
      requirePayload(projectile, ['poison'])
      const scale = projectile.visualScale
      const pulse = Math.sin(age * Math.PI / 180) * 0.25 + 0.75
      return plan(projectile, [
        layer('DeadHawg', 0, 'poison-pool-outer', {
          alpha: 0.5,
          scale,
        }),
        layer('DeadHawg', 0, 'poison-pool-inner', {
          alpha: pulse,
          scale: Math.max(scale - 0.6, 0) * scale * 0.75,
        }),
      ])
    }
  }
}

function requirePayload<Payload extends BoneyardEnemyProjectileSnapshot['payload']>(
  projectile: BoneyardEnemyProjectileSnapshot,
  supported: readonly Payload[],
): Payload {
  if (!(supported as readonly string[]).includes(projectile.payload)) {
    throw new Error(
      `enemy projectile ${projectile.kind} does not support ${projectile.payload} payload`,
    )
  }
  return projectile.payload as Payload
}

function plan(
  projectile: BoneyardEnemyProjectileSnapshot,
  layers: readonly NativeEnemyProjectileLayer[],
): NativeEnemyProjectilePlan {
  return { layers, position: { ...projectile.position } }
}

function layer(
  atlas: NativeEnemySampleAtlas,
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeEnemyProjectileLayer,
    'alpha' | 'blendMode' | 'offset' | 'rotationRadians' | 'scale' | 'scaleY' | 'tint'
  >> = {},
): NativeEnemyProjectileLayer {
  const scale = options.scale ?? 1
  return {
    alpha: options.alpha ?? 1,
    atlas,
    blendMode: options.blendMode ?? 'normal',
    entry,
    offset: options.offset ?? { x: 0, y: 0 },
    role,
    rotationRadians: options.rotationRadians ?? 0,
    scale,
    scaleY: options.scaleY ?? scale,
    tint: options.tint ?? 0xffffff,
  }
}

function remainingLifetimeAlpha(
  projectile: BoneyardEnemyProjectileSnapshot,
  age: number,
): number {
  return Math.min(Math.max(projectile.lifetimeTicks - age, 0) / 100, 1)
}

function sinDegrees(value: number): number {
  return Math.sin(value * Math.PI / 180)
}

function deterministicDomainSample(
  id: number,
  tick: number,
  layerIndex: number,
  count: number,
): number {
  let value = (
    (id >>> 0)
    ^ Math.imul((tick + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(layerIndex + 1, 0x85ebca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value = (value ^ (value >>> 15)) >>> 0
  return value % count
}

function deterministicUnit(id: number, tick: number, channel: number): number {
  let value = (
    (id >>> 0)
    ^ Math.imul((tick + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(channel + 1, 0x85ebca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value = (value ^ (value >>> 15)) >>> 0
  return value / 0x1_0000_0000
}
