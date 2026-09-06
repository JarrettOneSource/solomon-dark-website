import { NATIVE_BOSS_SPELL_MANAGER_LANES, type NativeBossSpell } from '../../core-kernels/native-boss-spell.ts'
import type { WorkingStep } from './model.ts'

export function createBossSpellOwner<Kind extends NativeBossSpell['kind']>(work: WorkingStep, ownerActorId: number, spawnTick: number, damage: number, kind: Kind) {
  return { ageTicks: 0, damage, id: work.nextProjectileId++, kind, painterRegistration: work.registerWorldPainter(NATIVE_BOSS_SPELL_MANAGER_LANES[kind]),
    ownerActorId, spawnTick }
}
