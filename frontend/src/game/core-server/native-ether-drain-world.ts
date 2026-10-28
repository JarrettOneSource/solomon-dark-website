import { nativeEtherDrainEnemyForceFactor, type NativeEtherDrainTarget, type NativeEtherDrainWorldAnimationContact, type NativeEtherDrainWorldAnimationTarget } from '../core-kernels/native-ether-drain.ts'
import type { NativeSecondarySimulationState } from '../core-kernels/native-secondary-abilities.ts'
import type { PlayerCharacterState } from '../core-kernels/player-character.ts'
import type { BoneyardWorldState } from './boneyard-world-state.ts'
import type { PlayerEntityStore } from './player-entity-store.ts'
import { boneyardNativeSecondaryTargets } from './native-secondary-world.ts'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import { nativeSkeletonHeadFacing } from '../core-kernels/boneyard-skeleton-family-animation.ts'
import { nativeSkeletonBaseTint } from '../core-kernels/native-skeleton-color.ts'
import type { NativeEtherDrainCapturedImage } from '../core-kernels/native-ether-drain.ts'
import type { BoneyardEnemyActor } from './enemies/model.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'

export function boneyardNativeEtherDrainTargets(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  entities: PlayerEntityStore,
  secondary: NativeSecondarySimulationState,
): readonly NativeEtherDrainTarget[] {
  const targets: NativeEtherDrainTarget[] = boneyardNativeSecondaryTargets(
    world.enemies, { x: 0, y: 0 }, Number.MAX_VALUE,
  ).map(target => ({
    activationDelayTicks: 0,
    forceFactor: nativeEtherDrainEnemyForceFactor(target.family),
    nativeFlags: target.nativeFlags ?? 2,
    position: target.position,
    ref: { kind: 'enemy', id: target.id, registrationOrdinal: target.lightRegistration.registrationOrdinal },
  }))
  for (const maggot of world.enemies.maggots) {
    if (maggot.lifeState !== 'alive' || maggot.combatActive) continue
    // Emergence/attack admission does not clear the inherited Badguy mask2.
    targets.push({ activationDelayTicks: 0, forceFactor: 1, nativeFlags: 2, position: maggot.position,
      ref: { kind: 'enemy', id: maggot.id, registrationOrdinal: maggot.lightRegistration.registrationOrdinal } })
  }
  for (const [index, { playerId }] of entities.identities.entries()) {
    const progression = entities.progressions[index]!
    const player = players[playerId]
    if (!player || progression.lifeState === 'spectating' || progression.corpseConsumed) continue
    targets.push({ activationDelayTicks: 0, forceFactor: 1, nativeFlags: 0x801,
      position: player.position, ref: { kind: 'player', id: playerId } })
  }
  for (const actor of world.loot.actors) {
    if (actor.kind !== 'gold' && actor.kind !== 'sack') continue
    targets.push({ activationDelayTicks: actor.activationDelayTicks, forceFactor: 1, nativeFlags: 0x400,
      position: actor.position, ref: { kind: 'loot', id: actor.id,
        registrationOrdinal: actor.painterRegistration.registrationOrdinal } })
  }
  for (const actor of secondary.actors) {
    if (actor.kind !== 'golem' || actor.worldKey !== `boneyard:${world.runId}` || actor.golem === null) continue
    targets.push({ activationDelayTicks: 0, forceFactor: .25, nativeFlags: 0x800,
      position: actor.position, ref: { kind: 'golem', id: actor.id } })
  }
  return targets
}

export function nativeEtherDrainCapturedImage(actor: BoneyardEnemyActor, tick: number): Omit<NativeEtherDrainCapturedImage, 'alpha' | 'kind'> | null {
  const facing = nativeEighteenWayFacingBucket(actor.headingDeg)
  const config = actor.config
  if (config.enemyToken === 'SKELETON' || config.enemyToken === 'SKELETONARCHER' || config.enemyToken === 'SKELETONMAGE') {
    const bases = [1477, 1531, 1549, 1495, 1513, 1567] as const
    return { atlas: 'BadGuys', bodyYOffset: 23,
      entry: bases[config.family.headgear] + nativeSkeletonHeadFacing(facing, actor.headFacingOffset),
      tint: nativeSkeletonBaseTint(actor, config.burning, actor.lighting.charge, Math.max(0, tick - actor.spawnTick), false),
    }
  }
  if (config.enemyToken === 'ZOMBIE' && actor.brain.family === 'zombie') {
    if (actor.brain.headType > 2) return null
    return { atlas: 'BadGuys', bodyYOffset: 0, entry: 2293 + actor.brain.headType * 18 + facing, tint: 0xffffff }
  }
  if (config.enemyToken === 'DEMON') return { atlas: 'Demon', bodyYOffset: 0, entry: 80 + facing, tint: 0xffffff }
  return null
}

export function boneyardNativeEtherDrainWorldAnimations(
  world: BoneyardWorldState,
  primary: PrimarySpellSimulationState,
  secondary: NativeSecondarySimulationState,
): readonly NativeEtherDrainWorldAnimationTarget[] {
  const targets: NativeEtherDrainWorldAnimationTarget[] = []
  for (const actor of world.deathWeapons) targets.push({ bounceVelocity: actor.motion.bounceVelocity,
    position: actor.motion.position, ref: { kind: 'death-weapon', id: actor.id } })
  for (const effect of world.enemies.deathEffects) {
    if (effect.kind !== 'bouncer' && effect.kind !== 'smoky-bouncer'
      && effect.kind !== 'black-smoky-bouncer' && effect.kind !== 'boulder-bit') continue
    targets.push({ bounceVelocity: effect.bounceVelocity, position: effect.position,
      ref: { kind: 'enemy-death-effect', id: effect.id } })
  }
  const worldKey = `boneyard:${world.runId}`
  for (const effect of primary.transients) {
    if (effect.worldKey !== worldKey) continue
    if (effect.kind === 'water-hail' || effect.kind === 'weld-hail-terrain-bouncer') {
      targets.push({ bounceVelocity: effect.kind === 'water-hail' ? effect.savedBounceVelocity : effect.bounceVelocity, position: effect.position,
        ref: { kind: 'primary-transient', id: effect.id } })
    } else if (effect.kind === 'weld-boulder-debris') {
      targets.push({ bounceVelocity: effect.debris.bounceVelocity, position: effect.position,
        ref: { kind: 'primary-transient', id: effect.id } })
    }
  }
  for (const actor of secondary.actors) {
    if (actor.worldKey === worldKey && actor.kind === 'golem-death' && actor.golemDeath) {
      actor.golemDeath.fragments.forEach((fragment, index) => {
        if (fragment) targets.push({ bounceVelocity: fragment.bounceVelocity, position: fragment.position,
          ref: { kind: 'golem-fragment', id: actor.id, index } })
      })
    }
    if (actor.worldKey !== worldKey || actor.kind !== 'earthquake-debris' && actor.kind !== 'golem-assembly-debris'
      && actor.kind !== 'stoneskin-chip' && actor.kind !== 'comet-debris') continue
    targets.push({ bounceVelocity: actor.kind === 'earthquake-debris' ? actor.quantity
      : actor.kind === 'golem-assembly-debris' ? actor.endpoint.x : actor.endpoint.y, position: actor.position,
      ref: { kind: 'secondary-actor', id: actor.id } })
  }
  return targets
}

/** Anim positions move directly, without the Puppet collision/velocity path. */
export function applyBoneyardEtherDrainWorldAnimationForces(
  sourceWorld: BoneyardWorldState,
  sourcePrimary: PrimarySpellSimulationState,
  sourceSecondary: NativeSecondarySimulationState,
  contacts: readonly NativeEtherDrainWorldAnimationContact[],
): Readonly<{ world: BoneyardWorldState; primary: PrimarySpellSimulationState;
  secondary: NativeSecondarySimulationState }> {
  let world = sourceWorld
  let primary = sourcePrimary
  let secondary = sourceSecondary
  for (const contact of contacts) {
    const shift = (point: Readonly<{ x: number; y: number }>) => ({
      x: Math.fround(point.x + contact.delta.x), y: Math.fround(point.y + contact.delta.y),
    })
    if (contact.ref.kind === 'death-weapon') {
      world = { ...world, deathWeapons: world.deathWeapons.flatMap(actor => actor.id !== contact.ref.id ? [actor]
        : contact.consume ? [] : [{ ...actor, motion: { ...actor.motion, position: shift(actor.motion.position) } }]) }
    } else if (contact.ref.kind === 'golem-fragment') {
      const { id, index } = contact.ref
      secondary = { ...secondary, actors: secondary.actors.map(actor => {
        if (actor.id !== id || actor.kind !== 'golem-death' || actor.golemDeath === undefined) return actor
        return { ...actor, golemDeath: { ...actor.golemDeath, fragments: actor.golemDeath.fragments.map((fragment, part) =>
          part !== index || fragment === null ? fragment : contact.consume ? null : { ...fragment, position: shift(fragment.position) }) } }
      }) }
    } else if (contact.ref.kind === 'enemy-death-effect') {
      world = { ...world, enemies: { ...world.enemies,
        deathEffects: world.enemies.deathEffects.flatMap(effect => {
          if (effect.id !== contact.ref.id) return [effect]
          return contact.consume ? [] : [{ ...effect, position: shift(effect.position) }]
        }),
      } }
    } else if (contact.ref.kind === 'primary-transient') {
      primary = { ...primary, transients: primary.transients.flatMap(effect => {
        if (effect.id !== contact.ref.id || effect.kind !== 'water-hail'
          && effect.kind !== 'weld-hail-terrain-bouncer' && effect.kind !== 'weld-boulder-debris') return [effect]
        if (contact.consume) return []
        const position = shift(effect.position)
        return effect.kind === 'weld-boulder-debris'
          ? [{ ...effect, position, debris: { ...effect.debris, position } }] : [{ ...effect, position }]
      }) }
    } else {
      secondary = { ...secondary, actors: secondary.actors.flatMap(actor => {
        if (actor.id !== contact.ref.id) return [actor]
        return contact.consume ? [] : [{ ...actor, position: shift(actor.position) }]
      }) }
    }
  }
  return { world, primary, secondary }
}
