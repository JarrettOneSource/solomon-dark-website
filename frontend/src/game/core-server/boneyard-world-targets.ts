import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { NativeWorldPuppetHitKind } from '../core-kernels/native-puppet-hit.ts'
import type { BoneyardLightEnvironment } from './boneyard-world-light.ts'
import type { BoneyardWorldState } from './boneyard-world-state.ts'
import type { BoneyardPuppetTarget } from './enemies/model.ts'
import { primaryTargetRows } from './spell-combat/targets.ts'

export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  return [...boneyardWorldSceneryTargets(world), ...primaryTargetRows(world.enemies).map(({ target }) => target)]
}

export function boneyardWorldSceneryTargets(world: BoneyardWorldState): BoneyardPuppetTarget[] {
  return [
    ...world.primarySceneryTargets.map(target => ({ ...target, hitKind: 'scenery' as const })),
    ...world.loot.goodies.map(goodie => ({
      ...boneyardPuppetTarget(`goodie:${goodie.id}`, goodie.position, 0x2004, goodie.sceneryRegistrationOrdinal, 'goodie'),
      bodyRadius: 20, nativePriority: 1000, kind: 'scenery' as const,
    })),
  ]
}

export function boneyardMouthWorldTargets(
  world: BoneyardWorldState, environment: BoneyardLightEnvironment,
): BoneyardPuppetTarget[] {
  const targets = boneyardWorldSceneryTargets(world)
  const worldKey = `boneyard:${world.runId}`
  for (const actor of environment.primarySpells?.transients ?? []) {
    if (actor.kind !== 'weld-meteor' || actor.worldKey !== worldKey) continue
    targets.push({ ...boneyardPuppetTarget(`primary:${actor.id}`, actor.position, 8,
      actor.lightRegistration.registrationOrdinal, 'meteor'), gridPosition: { x: 0, y: 0 } })
  }
  for (const actor of environment.secondaryAbilities?.actors ?? []) {
    if (actor.kind !== 'leviathan' || actor.worldKey !== worldKey) continue
    if (actor.lightRegistration === null) throw new Error('Leviathan lost its native actor registration')
    targets.push(boneyardPuppetTarget(`secondary:${actor.id}`, actor.position, 0x200,
      actor.lightRegistration.registrationOrdinal, 'leviathan'))
  }
  return targets
}

export function boneyardPuppetTarget(
  id: string, position: Readonly<BoneyardPoint>, actorFlags: number, registrationOrder: number,
  hitKind: NativeWorldPuppetHitKind | null, queryLane: PrimarySpellTarget['queryLane'] = 'grid',
): BoneyardPuppetTarget {
  return {
    active: true, actorFlags, attachment: { x: 0, y: 0 }, bodyRadius: 0, cellBindingOrder: registrationOrder,
    hitKind, id, kind: 'projectile', nativePriority: 0, pendingRemove: false, position: { ...position },
    queryLane, registrationOrder,
  }
}
