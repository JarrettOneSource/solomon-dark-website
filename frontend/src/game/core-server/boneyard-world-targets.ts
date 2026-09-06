import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import type { BoneyardWorldState } from './boneyard-world-state.ts'
import { boneyardEnemyActorFlags, boneyardEnemyCollisionRadius } from './enemies/model.ts'


export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  const actors = world.enemies.actors
    .map((enemy) => ({
      active: enemy.lifeState === 'alive',
      actorFlags: boneyardEnemyActorFlags(enemy),
      attachment: { x: 0, y: 0 },
      bodyRadius: boneyardEnemyCollisionRadius(enemy),
      cellBindingOrder: enemy.nativeCellBindingOrder,
      headingDeg: enemy.headingDeg,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
      registrationOrder: enemy.nativeRegistrationOrder,
    }))
  const maggots = world.enemies.maggots
    .map((enemy) => ({
      active: enemy.lifeState === 'alive' && enemy.combatActive,
      actorFlags: 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: enemy.collisionRadius,
      cellBindingOrder: enemy.nativeCellBindingOrder,
      headingDeg: enemy.headingDeg,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
      registrationOrder: enemy.nativeRegistrationOrder,
    }))
  const enemies: PrimarySpellTarget[] = [...actors, ...maggots]
  return [...world.primarySceneryTargets, ...enemies]
}
