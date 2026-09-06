import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import {
  buildNativeAirContactLightSource,
  buildNativeAirPathLightSources,
} from '../core-kernels/native-air-presentation.ts'
import {
  NativeBoneyardLightIndex,
  nativeBoulderLightSource,
  nativeEnemyLightSources,
  nativeEnemyProjectileEffectLightProvider,
  nativeEnemyProjectileLightProvider,
  nativeFirePatchLightSource,
  nativeLanternLightSource,
  nativeMissileLightSource,
  nativePlayerLightSource,
  nativeSecondaryMiscLightSource,
  nativeSecondaryProviderLightSource,
  nativeWeldMeteorLightSource,
  nativeWeldProjectileLightSource,
  nativeWeldRockLightSource,
  type NativeBoneyardLightSource,
} from '../core-kernels/native-boneyard-light-model.ts'
import { nativeBossSpellLight } from '../core-kernels/native-boss-spell-light.ts'
import {
  etherPrimaryImpactLightSource,
  nativeFireEmberLightSource,
  nativeFireExplosionLightSource,
  nativeFireGoodImpLightSource,
  nativeFireImpactLightSource,
  nativeFireballLightSource,
} from '../core-kernels/native-primary-light-sources.ts'
import { nativeRegionPointGain } from '../core-kernels/native-region-point-gain.ts'
import type { NativeSecondarySimulationState } from '../core-kernels/native-secondary-abilities.ts'
import { mergeNativeWorldManagerOwners, type NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import {
  NATIVE_GAMEPLAY_VIEWPORT_HEIGHT,
  NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import { nativePlayerElementEffectPhase } from '../core-kernels/player-lighting.ts'
import { nativePrimaryViewBounds } from '../core-kernels/primary-spell-targeting.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type { BoneyardWorldState } from './boneyard-world-state.ts'
import type { BoneyardEnemyStore } from './enemies/model.ts'
import type { PlayerEntityStore } from './player-entity-store.ts'

export interface BoneyardLightEnvironment {
  readonly inputs?: Readonly<Record<string, PlayerCharacterInput>>
  readonly playerEntities?: Pick<PlayerEntityStore, 'identities' | 'lightings'>
  readonly primarySpells?: PrimarySpellSimulationState
  readonly secondaryAbilities?: NativeSecondarySimulationState
}

interface LightOwner {
  readonly registration: NativeWorldManagerRegistration
  readonly sources: readonly NativeBoneyardLightSource[]
}

/** The simulation queries the stock view of every participant at a fixed tick. */
export function boneyardWorldLightQuery(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
  tick: number,
  environment: BoneyardLightEnvironment = {},
) {
  const cameraRows = Object.entries(players).map(([id, player]) => {
    const input = environment.inputs?.[id]
    return nativePrimaryViewBounds({
      bounds: world.arenaTransition?.cameraBounds ?? world.bounds,
      focus: player.position,
      padding: 0,
      scale: 1.35,
      viewportWidth: input?.viewportWidth ?? NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
      viewportHeight: input?.viewportHeight ?? NATIVE_GAMEPLAY_VIEWPORT_HEIGHT,
    })
  })
  const pointGainAt = (position: Readonly<BoneyardPoint>): number => cameraRows.reduce(
    (gain, camera) => Math.max(gain, nativeRegionPointGain(position, {
      x: camera.x + camera.w / 2, y: camera.y + camera.h / 2,
    }, camera.w, false)), 0,
  )
  const providers: LightOwner[] = []
  const misc: (LightOwner & { birthTick: number; id: number; ordinal: number })[] = []
  const append = (source: NativeBoneyardLightSource | null, registration: NativeWorldManagerRegistration | null) => {
    if (source === null) return
    if (registration === null) throw new Error('Native light source lost its manager registration')
    providers.push({ registration, sources: [source] })
  }
  for (const [index, [id, player]] of Object.entries(players).entries()) {
    const entityIndex = environment.playerEntities?.identities.findIndex(({ playerId }) => playerId === id) ?? -1
    const lighting = environment.playerEntities?.lightings[entityIndex]
    append(nativePlayerLightSource({
      ...player, id,
      lighting: {
        driveActive: false,
        overlayEffectPhase: nativePlayerElementEffectPhase(player.primaryCast.weaponPulse, lighting?.overlayEffectPhase ?? 0),
      },
    }, tick, true), lighting?.lightRegistration ?? { managerLane: 'actor', registrationOrdinal: index + 1 })
  }
  for (const actor of enemies.actors) {
    const sources = nativeEnemyLightSources({
      burning: actor.config.burning,
      scale: actor.config.scale,
      ...(actor.brain.family === 'demon-skull' ? { demonSkull: actor.brain } : {}),
      id: actor.id,
      enemyToken: actor.config.enemyToken,
      flags: actor.config.flags,
      position: actor.position,
      lighting: actor.lighting,
      animation: { state: actor.lifeState === 'dying' ? 'death' : 'idle', alpha: actor.brain.family === 'portal' ? actor.brain.alpha : 1 },
    }, tick)
    if (sources.length > 0) providers.push({ registration: actor.lightRegistration, sources })
  }
  for (const effect of enemies.deathEffects) {
    if (effect.kind !== 'banish-black' || effect.painterRegistration === null) continue
    append({ castsDirectionalShadow: true, position: effect.position, radius: 3,
      intensity: Math.min(1, Math.max(0, Math.fround(2 - effect.ageTicks * .004999999888241291))),
    }, effect.painterRegistration)
  }
  for (const spell of enemies.bossSpells) {
    append(nativeBossSpellLight(spell, tick, true), spell.painterRegistration)
  }
  const worldKey = `boneyard:${world.runId}`
  for (const spell of environment.primarySpells?.projectiles ?? []) {
    if (spell.worldKey !== worldKey) continue
    const source = (() => {
      switch (spell.kind) {
        case 'earth': return nativeBoulderLightSource(spell)
        case 'ether': return nativeMissileLightSource(spell, tick)
        case 'fire': return nativeFireballLightSource(spell, tick)
        case 'weld': return nativeWeldProjectileLightSource(spell, tick)
      }
    })()
    append(source, spell.lightRegistration)
  }
  for (const projectile of enemies.projectiles) {
    append(nativeEnemyProjectileLightProvider(projectile, tick)?.source ?? null, projectile.lightRegistration)
  }
  for (const effect of enemies.projectileEffects) {
    append(nativeEnemyProjectileEffectLightProvider(effect, true, pointGainAt(effect.position))?.source ?? null, effect.lightRegistration)
  }
  for (const effect of environment.primarySpells?.transients ?? []) {
    if (effect.worldKey !== worldKey) continue
    if (effect.kind === 'fire-patch') {
      if (effect.ageTicks > 0) append(nativeFirePatchLightSource(effect.position, effect.life), effect.painterRegistrations[0]!)
      continue
    }
    let source: NativeBoneyardLightSource | null = null
    switch (effect.kind) {
      case 'weld-meteor': source = nativeWeldMeteorLightSource(effect); break
      case 'weld-persistent':
        if (effect.buildId === 1006 || effect.buildId === 1008) source = nativeWeldRockLightSource(effect)
        break
      case 'fire-ember': source = nativeFireEmberLightSource(effect, tick); break
      case 'fire-explosion': source = nativeFireExplosionLightSource(effect, pointGainAt(effect.origin)); break
      case 'fire-good-imp': source = nativeFireGoodImpLightSource(effect, tick); break
      case 'ether-impact': source = etherPrimaryImpactLightSource(effect); break
      case 'fire-impact': source = nativeFireImpactLightSource(effect); break
      case 'air': {
        source = buildNativeAirContactLightSource({
          ageTicks: effect.ageTicks, endpoint: { x: effect.endpoint.x - effect.origin.x, y: effect.endpoint.y - effect.origin.y },
          id: effect.id, origin: effect.origin, underpowered: effect.underpowered,
        })
        if (effect.ageTicks === 0) {
          const ownerIndex = environment.playerEntities?.identities.findIndex(({ playerId }) => playerId === effect.ownerId) ?? -1
          const registration = environment.playerEntities?.lightings[ownerIndex]?.lightRegistration
          if (registration === undefined) throw new Error('Air MiscLight lost its player owner')
          misc.push({
            birthTick: effect.birthTick, id: effect.id, ordinal: 0, registration,
            sources: buildNativeAirPathLightSources({ ...effect, weakCast: effect.underpowered }),
          })
        }
        break
      }
    }
    if (source !== null) {
      if (!('lightRegistration' in effect)) throw new Error('Primary light source lost its manager registration')
      append(source, effect.lightRegistration)
    }
  }
  const secondaryActors = (environment.secondaryAbilities?.actors ?? []).filter((actor) => actor.worldKey === worldKey)
  for (const actor of secondaryActors) {
    append(nativeSecondaryProviderLightSource(actor, tick, true, pointGainAt(actor.position)), actor.lightRegistration)
    const source = nativeSecondaryMiscLightSource(actor)
    if (source === null) continue
    if (actor.lightRegistration === null || actor.miscLightAppendOrdinal === null) throw new Error('MiscLight lost its native append order')
    misc.push({
      birthTick: tick - actor.ageTicks, id: actor.id, ordinal: actor.miscLightAppendOrdinal,
      registration: actor.lightRegistration, sources: [source],
    })
  }
  for (const pulse of enemies.mageLightningPulses) {
    if (pulse.tick !== tick) continue
    const owner = enemies.actors.find(({ id }) => id === pulse.ownerActorId)
    if (owner === undefined) continue
    const ordinal = secondaryActors.reduce((next, actor) => (
      actor.targetId === owner.id && nativeSecondaryMiscLightSource(actor) !== null
        ? Math.max(next, (actor.miscLightAppendOrdinal ?? -1) + 1) : next
    ), 0)
    misc.push({
      birthTick: pulse.tick, id: pulse.id, ordinal, registration: owner.lightRegistration,
      sources: buildNativeAirPathLightSources({ birthTick: pulse.tick, id: pulse.seed, origin: pulse.source, midpoint: pulse.midpoint, endpoint: pulse.endpoint }),
    })
  }
  if (world.lanternPosition !== null) append(nativeLanternLightSource(world.lanternPosition, tick), world.lanternLightRegistration)
  const sources = mergeNativeWorldManagerOwners([providers], ({ registration }) => registration).flatMap(({ sources }) => sources)
  misc.sort((a, b) => a.ordinal - b.ordinal || a.birthTick - b.birthTick || a.id - b.id)
  const tail = mergeNativeWorldManagerOwners([misc], ({ registration }) => registration).flatMap(({ sources }) => sources)
  const indices = cameraRows.map((camera) => {
    const index = new NativeBoneyardLightIndex({ width: world.bounds.w, height: world.bounds.h })
    index.rebuild(sources, tail, {
      camera: { x: camera.x + camera.w / 2, y: camera.y + camera.h / 2, zoom: 1.35 },
      viewport: { width: camera.w * 1.35, height: camera.h * 1.35 },
    })
    return index
  })
  return {
    acceptedSources: indices.flatMap(index => index.acceptedSources),
    cameras: cameraRows,
    scalarAt: (position: Readonly<BoneyardPoint>): number => indices.reduce((value, index) => Math.max(value, index.scalarAt(position)), 0),
  }
}
