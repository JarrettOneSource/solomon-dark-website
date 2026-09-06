import type { BoneyardSkeletonWeapon } from '../../core-kernels/boneyard-enemy-config-model.ts'
import type { DeathEffectOwner } from './death-effects.ts'
import { spawnBouncer, spawnRadialBouncer, spawnSimpleDeathEffect, spawnUnbind } from './death-effects.ts'
import { spawnHeartmongerDeparture } from './heartmonger.ts'
import type { BoneyardEnemyActor, WorkingStep } from './model.ts'
import { drawInteger, drawUnit, radialVector, signedUnit } from './random.ts'
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
  shuffleBoneFragments(work, entries)
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
    if (headgear === 1 || headgear === 2 || headgear === 4 || headgear === 5) {
      const firstEntry = 92 + (headgear - (headgear > 3 ? 2 : 1)) * 2
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
  minimumDistance = 15,
  distanceRange = 10,
): void {
  spawnBouncer(work, actor, tick, entry, role, () => {
    const velocity = radialVector(
      typeof angleDeg === 'function' ? angleDeg() : angleDeg,
      1,
    )
    velocity.x *= 1.5
    const distance = Math.fround(minimumDistance + drawUnit(work) * distanceRange)
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


function shuffleBoneFragments(work: WorkingStep, entries: number[]): void {
  for (let index = 0; index < entries.length; index += 1) {
    const swap = drawInteger(work, entries.length)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
}


export function spawnHeartmongerShatter(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  // 0x0049FB60; the browser's Enhanced Effects setting is fixed on.
  const entries = [113, 113, 113, 113, 113, 115, 118,
    121, 120, 119, 116, 121, 120, 119, 116, 121, 120, 119, 116,
    ...Array<number>(11).fill(117)]
  shuffleBoneFragments(work, entries)
  let angle = drawUnit(work) * 360
  for (const entry of entries) {
    spawnSkeletonFragmentBouncer(work, actor, tick, entry, 'heartmonger-bone', angle,
      Math.fround(Math.fround(1.2000000476837158) * 1.350000023841858), 15)
    angle = Math.fround(angle + 72 + signedUnit(drawUnit(work)) * 10)
  }
  for (let index = 0; index < 20; index += 1) {
    spawnSkeletonFragmentBouncer(work, actor, tick, () => 172 + drawInteger(work, 3),
      'heartmonger-splinter', () => drawUnit(work) * 360, 1.2000000476837158, 15, 5, 30)
  }
  for (let index = 0; index < 7; index += 1) {
    spawnSkeletonFragmentBouncer(work, actor, tick, 29, 'heartmonger-fragment',
      () => drawUnit(work) * 360, 1.2000000476837158, 15, 5, 30)
  }
  spawnBouncer(work, actor, tick, () => 1819 + drawInteger(work, 4), 'heartmonger-skull',
    { opacityTimer: 15, scale: 1.350000023841858, velocity: radialVector(angle, 2) })
  spawnUnbind(work, actor, tick)
  spawnHeartmongerDeparture(work, actor, tick)
}
