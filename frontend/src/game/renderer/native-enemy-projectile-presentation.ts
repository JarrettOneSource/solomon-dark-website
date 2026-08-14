import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import type { NativeEnemySampleAtlas } from './native-enemy-animation.ts'

export interface NativeEnemyProjectileLayer {
  readonly alpha: number
  readonly atlas: NativeEnemySampleAtlas
  readonly entry: number
  readonly role: string
  readonly rotationRadians: number
  readonly scale: number
}

export interface NativeEnemyProjectilePlan {
  readonly layers: readonly NativeEnemyProjectileLayer[]
  readonly position: Readonly<{ x: number; y: number }>
}

/**
 * Uses recovered projectile-owned atlas ranges. Per-family sub-frame cadence is
 * still a named bounded web program where the native clock remains unresolved.
 */
export function nativeEnemyProjectilePlan(
  projectile: BoneyardEnemyProjectileSnapshot,
): NativeEnemyProjectilePlan {
  const age = Math.max(0, Math.floor(projectile.ageTicks))
  switch (projectile.kind) {
    case 'arrow': return plan(projectile, [{
      alpha: 1,
      atlas: 'BadGuys',
      entry: 255 + facingBucket(projectile.headingDeg, 12),
      role: 'arrow',
      rotationRadians: 0,
      scale: 1,
    }])
    case 'firebolt': return plan(projectile, [{
      alpha: 1,
      atlas: 'BadGuys',
      entry: 251 + facingBucket(projectile.headingDeg, 16),
      role: 'firebolt',
      rotationRadians: 0,
      scale: 1,
    }])
    case 'guided-missile': return plan(projectile, [{
      alpha: 1,
      atlas: 'BadGuys',
      entry: 110 + age % 3,
      role: 'guided-missile',
      rotationRadians: projectile.headingDeg * Math.PI / 180,
      scale: 1,
    }])
    case 'demon-bomb': return plan(projectile, [{
      alpha: 1,
      atlas: 'BadGuys',
      entry: 267 + age % 4,
      role: 'demon-bomb',
      rotationRadians: age * 0.08,
      scale: 1,
    }])
    case 'poison-pool': return plan(projectile, [{
      alpha: Math.max(0, 1 - age / projectile.lifetimeTicks),
      atlas: 'DeadHawg',
      entry: 46 + Math.min(31, age),
      role: 'poison-pool',
      rotationRadians: 0,
      scale: Math.max(1, projectile.contactRadius / 20),
    }])
  }
}

function plan(
  projectile: BoneyardEnemyProjectileSnapshot,
  layers: readonly NativeEnemyProjectileLayer[],
): NativeEnemyProjectilePlan {
  return { layers, position: { ...projectile.position } }
}

function facingBucket(headingDeg: number, count: number): number {
  const normalized = ((headingDeg % 360) + 360) % 360
  return Math.floor((normalized + 180 / count) / (360 / count)) % count
}
