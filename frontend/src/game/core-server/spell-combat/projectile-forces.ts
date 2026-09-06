import type { Vector2 } from '../../core-kernels/vector.ts'
import { setBoneyardArrowChillTumbleAccumulator, tumbleBoneyardArrow } from '../enemies/projectile-effects.ts'
import { applyBoneyardSilkForce } from '../enemies/silk-force.ts'
import type { PrimaryForceTargetRow } from './targets.ts'
import type { BoneyardSpellCombatWork } from './work.ts'

export function applyChannelProjectileForce(
  work: BoneyardSpellCombatWork,
  row: PrimaryForceTargetRow,
  amount: number,
  direction: Readonly<Vector2>,
): void {
  if (row.kind === 'silk') {
    if (work.lightAt === null) throw new Error('Silk force requires the native light sampler')
    const result = applyBoneyardSilkForce(
      work.enemies, row.projectile.id, amount, direction, work.tick, work.rng, work.lightAt,
    )
    work.enemies = result.store
    work.rng = result.rng
    return
  }
  const accumulator = Math.fround(row.projectile.chillTumbleAccumulator + amount)
  if (accumulator <= 1) {
    work.enemies = setBoneyardArrowChillTumbleAccumulator(work.enemies, row.projectile.id, accumulator)
    return
  }
  const result = tumbleBoneyardArrow(
    work.enemies, row.projectile.id, direction, work.tick, work.rng, work.registerWorldPainter,
  )
  work.enemies = result.store
  work.rng = result.rng
  work.events.push(...result.events)
}
