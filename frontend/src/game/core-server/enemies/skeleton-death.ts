import type { BoneyardSkeletonWeapon } from '../../core-kernels/boneyard-enemy-config.ts'
import {
  type DeathEffectOwner,
  spawnBouncer,
  spawnRadialBouncer,
  spawnSimpleDeathEffect,
  spawnUnbind,
} from './death-effects.ts'
import type { BoneyardEnemyActor, WorkingStep } from './model.ts'
import { drawInteger, drawUnit, radialVector } from './random.ts'

export const SKELETON_BASE_FRAGMENT_ENTRIES = Object.freeze([
  113, 113, 113, 115, 118, 121, 120, 119, 116,
  121, 120, 119, 116, 117, 117, 117, 117, 117,
] as const)

export function spawnSkeletonShatter(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const entries = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swap = drawInteger(work, index + 1)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = drawUnit(work) * 360
  for (const entry of entries) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      entry,
      'skeleton-bone',
      angleDeg,
      1.2,
    )
    angleDeg += 72 + (drawUnit(work) * 20 - 10)
  }
  spawnSkeletonEquipmentEffects(work, actor, tick)
  spawnRadialBouncer(
    work,
    actor,
    tick,
    () => 1819 + drawInteger(work, 4),
    'skeleton-skull',
    2,
  )
  spawnUnbind(work, actor, tick)
}

function spawnSkeletonEquipmentEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  if (
    actor.config.enemyToken === 'SKELETON'
    || actor.config.enemyToken === 'SKELETONARCHER'
    || actor.config.enemyToken === 'SKELETONMAGE'
  ) {
    const headgear = actor.config.family.headgear
    if (headgear === 1 || headgear === 2) {
      const firstEntry = headgear === 1 ? 92 : 94
      spawnSkeletonFragmentBouncer(
        work,
        actor,
        tick,
        () => firstEntry + drawInteger(work, 2),
        'skeleton-headgear-fragment',
        () => drawUnit(work) * 360,
        1.2,
      )
    }
  }
  if (actor.config.enemyToken !== 'SKELETON') return

  const weaponEntry = skeletonWeaponDeathEntry(actor.config.family.weapon)
  if (weaponEntry !== null) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      weaponEntry,
      'skeleton-weapon-fragment',
      () => drawUnit(work) * 360,
    )
  } else if (actor.config.family.weapon === 'pike') {
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 1,
      alphaLossPerTick: 1 / 25,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 15,
      kind: 'fade',
      lifetimeTicks: 25,
      role: 'skeleton-pike-flash',
      scale: 3,
    })
    for (let index = 0; index < 7; index += 1) {
      spawnSkeletonFragmentBouncer(
        work,
        actor,
        tick,
        55,
        'skeleton-pike-fragment',
        () => drawUnit(work) * 360,
        1,
        1.5,
      )
    }
  }

  if (!actor.config.family.armor) return
  for (const firstEntry of [100, 102, 104, 106, 108]) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      () => firstEntry + drawInteger(work, 2),
      'skeleton-armor-fragment',
      () => drawUnit(work) * 360,
    )
  }
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: 1 / 25,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 15,
    kind: 'fade',
    lifetimeTicks: 25,
    position: { x: actor.position.x, y: actor.position.y - 35 },
    role: 'skeleton-armor-flash',
    scale: 3,
  })
}

function skeletonWeaponDeathEntry(weapon: BoneyardSkeletonWeapon): number | null {
  switch (weapon) {
    case 'axe':
      return 2066
    case 'flail':
      return 2065
    case 'mace':
      return 2064
    case 'sword':
      return 2063
    case 'claw':
    case 'pike':
      return null
  }
}

function spawnSkeletonFragmentBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number | (() => number),
  role: string,
  angleDeg: number | (() => number),
  scale = 1,
  opacityTimer = 10,
): void {
  spawnBouncer(work, actor, tick, entry, role, () => {
    const velocity = radialVector(
      typeof angleDeg === 'function' ? angleDeg() : angleDeg,
      1,
    )
    velocity.x *= 1.5
    const distance = 15 + drawInteger(work, 11)
    return {
      opacityTimer,
      position: {
        x: actor.position.x + velocity.x * (distance + 2),
        y: actor.position.y + velocity.y * distance,
      },
      scale,
      velocity,
    }
  })
}
