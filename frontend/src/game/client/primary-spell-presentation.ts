import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import {
  copyPrimarySpellProjectile,
  interpolatePrimarySpellProjectile,
} from './primary-spell-projectile-presentation.ts'
import {
  interpolatePrimarySpellTransients,
  type PrimarySpellPresentationTime,
} from './primary-spell-transient-presentation.ts'
import { copyPrimarySpellTransient } from './primary-spell-transient-copy.ts'

export function copyPrimarySpellState(
  spells: PrimarySpellSimulationState,
): PrimarySpellSimulationState {
  return {
    nextId: spells.nextId,
    projectiles: spells.projectiles.map(copyPrimarySpellProjectile),
    transients: spells.transients.map(copyPrimarySpellTransient),
  }
}

export function interpolatePrimarySpellState(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
  time: PrimarySpellPresentationTime,
): PrimarySpellSimulationState {
  const newerProjectiles = new Map(newer.projectiles.map((spell) => [spell.id, spell]))
  const projectiles = older.projectiles.map((spell) => {
    const next = newerProjectiles.get(spell.id)
    return next
      ? interpolatePrimarySpellProjectile(spell, next, blend)
      : copyPrimarySpellProjectile(spell)
  })
  const transients = interpolatePrimarySpellTransients(older, newer, blend, time)
  if (blend >= 1) {
    const projectileIds = new Set(projectiles.map((spell) => spell.id))
    for (const spell of newer.projectiles) {
      if (!projectileIds.has(spell.id)) projectiles.push(copyPrimarySpellProjectile(spell))
    }
  }
  return {
    nextId: blend < 1 ? older.nextId : newer.nextId,
    projectiles: blend < 1
      ? projectiles
      : projectiles.filter((spell) => newerProjectiles.has(spell.id)),
    transients,
  }
}
