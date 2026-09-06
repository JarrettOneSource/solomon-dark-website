import type { Vec2 } from '../../editor/model.ts'
import type { Camera } from '../../editor/render.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  type NativeWorldManagerRegistration,
  mergeNativeWorldManagerOwners,
} from '../core-kernels/native-world-manager-order.ts'
import { gameLightQuality } from '../game-settings.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import {
  NATIVE_PLAYER_LIGHT_RADIUS,
  NativeBoneyardLightIndex,
  type NativeBoneyardLightSource,
  nativeBoneyardLightScalar,
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
} from './boneyard-lighting.ts'
import {
  type BoneyardWorldPresentationSettings,
  requireBoneyardSnapshot,
} from './boneyard-renderer-model.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { nativeLevelUpPresentationFrame } from './level-up-presentation.ts'
import { NativeMageLightningPulseViews } from './native-mage-lightning-pulse-view.ts'
import { NativeSecondaryWorldView } from './native-secondary-world-view.ts'
import {
  buildNativeAirContactLightSource,
  buildNativeAirPathLightSources,
} from './primary-spell-air-native.ts'
import { etherPrimaryImpactLightSource } from './primary-spell-ether-native.ts'
import {
  nativeFireEmberLightSource,
  nativeFireExplosionLightSource,
  nativeFireGoodImpLightSource,
  nativeFireImpactLightSource,
  nativeFireballLightSource,
} from './primary-spell-fire-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'

interface RegisteredBoneyardLightProviderOwner {
  registration: NativeWorldManagerRegistration
  sources: readonly NativeBoneyardLightSource[]
}

interface RegisteredBoneyardMiscLightBatch extends RegisteredBoneyardLightProviderOwner {
  birthTick: number
  id: number
  miscLightAppendOrdinal: number
}

function requiredLightRegistration(
  registration: NativeWorldManagerRegistration | null,
  owner: string,
): NativeWorldManagerRegistration {
  if (registration === null) {
    throw new Error(`${owner} emitted a light without native manager registration`)
  }
  return registration
}

export class BoneyardSceneLights {
  private readonly lightMiscBatches: RegisteredBoneyardMiscLightBatch[] = []
  private readonly lightProviderOwners: RegisteredBoneyardLightProviderOwner[] = []
  private readonly lightSourceCandidates: NativeBoneyardLightSource[] = []
  private readonly lightMiscTailCandidates: NativeBoneyardLightSource[] = []
  private readonly enemyLightRegistrations = new Map<
    number,
    NativeWorldManagerRegistration
  >()
  readonly index: NativeBoneyardLightIndex
  private readonly boneyard: LoadedBoneyard
  constructor(boneyard: LoadedBoneyard) {
    this.boneyard = boneyard
    this.index = new NativeBoneyardLightIndex({
      height: boneyard.scene.bounds.h, width: boneyard.scene.bounds.w,
    })
  }
  update(
    snapshot: GameSnapshot,
    localPlayerId: string,
    presentationFrame: number,
    settings: BoneyardWorldPresentationSettings,
    levelUpFrame: ReturnType<typeof nativeLevelUpPresentationFrame> | null,
    camera: Camera,
    viewport: GameViewportLayout,
    primarySpells: PrimarySpellWorldView,
    secondaryAbilities: NativeSecondaryWorldView,
    mageLightningPulses: NativeMageLightningPulseViews,
    pointGainAt: (position: Readonly<Vec2>) => number,
  ) {
    requireBoneyardSnapshot(snapshot, this.boneyard.runId)
    const materializingPlayerIds = new Set(snapshot.materializingPlayerIds)
    const dig = this.boneyard.scene.solomonDig
    const lanternLight = snapshot.world.lanternPosition
      ? nativeLanternLightSource(
          snapshot.world.lanternPosition,
          presentationFrame,
          settings.multipleShadows,
        )
      : null
    const lightProviderOwners = this.lightProviderOwners
    lightProviderOwners.length = 0
    const lightSourceCandidates = this.lightSourceCandidates
    lightSourceCandidates.length = 0
    let localPlayerLight: NativeBoneyardLightSource | null = null
    for (const playerId in snapshot.players) {
      if (materializingPlayerIds.has(playerId)) continue
      const player = snapshot.players[playerId]
      const playerLight = nativePlayerLightSource({
        ...player,
        id: playerId,
      }, presentationFrame, playerId === localPlayerId)
      if (playerLight) {
        if (playerId === localPlayerId) localPlayerLight = playerLight
        if (playerId === localPlayerId && levelUpFrame?.emitting) {
          playerLight.radius = (
            (1 + player.lighting.overlayEffectPhase) * NATIVE_PLAYER_LIGHT_RADIUS
            + (levelUpFrame.lightRadius - 2.6)
          )
        }
        lightProviderOwners.push({
          registration: player.lighting.lightRegistration,
          sources: [playerLight],
        })
      }
    }
    for (const enemy of snapshot.world.enemies) {
      const sources = nativeEnemyLightSources(
        enemy,
        presentationFrame,
        settings.multipleShadows,
      )
      if (sources.length === 0) continue
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          enemy.lightRegistration,
          `enemy ${enemy.id}`,
        ),
        sources,
      })
    }
    for (const spell of snapshot.primarySpells.projectiles) {
      if (spell.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      let source: NativeBoneyardLightSource
      switch (spell.kind) {
        case 'earth':
          source = nativeBoulderLightSource(spell, settings.multipleShadows)
          break
        case 'ether':
          source = nativeMissileLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
        case 'fire':
          source = nativeFireballLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
        case 'weld':
          source = nativeWeldProjectileLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
      }
      lightProviderOwners.push({
        registration: spell.lightRegistration,
        sources: [source],
      })
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      const candidate = nativeEnemyProjectileLightProvider(
        projectile,
        presentationFrame,
        settings.multipleShadows,
      )
      if (!candidate) continue
      const registration = requiredLightRegistration(
        projectile.lightRegistration,
        `enemy projectile ${projectile.id}`,
      )
      if (registration.managerLane !== candidate.lane) {
        throw new Error(`enemy projectile ${projectile.id} changed native light-manager lane`)
      }
      lightProviderOwners.push({ registration, sources: [candidate.source] })
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      const candidate = nativeEnemyProjectileEffectLightProvider(effect, settings.multipleShadows, pointGainAt(effect.position))
      if (!candidate) continue
      const registration = requiredLightRegistration(
        effect.lightRegistration,
        `enemy projectile effect ${effect.id}`,
      )
      if (registration.managerLane !== candidate.lane) {
        throw new Error(`enemy projectile effect ${effect.id} changed native light-manager lane`)
      }
      lightProviderOwners.push({ registration, sources: [candidate.source] })
    }
    for (const effect of snapshot.primarySpells.transients) {
      if (effect.kind === 'fire-patch' && effect.worldKey === `boneyard:${snapshot.world.runId}`) {
        if (effect.ageTicks > 0) lightProviderOwners.push({
          registration: effect.painterRegistrations[0]!,
          sources: [nativeFirePatchLightSource(effect.position, effect.life, settings.multipleShadows)],
        })
        continue
      }
      if (
        effect.kind === 'weld-meteor'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        const source = nativeWeldMeteorLightSource(effect)
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: source === null ? [] : [source],
        })
        continue
      }
      if (
        effect.kind === 'weld-persistent'
        && (effect.buildId === 1006 || effect.buildId === 1008)
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeWeldRockLightSource(effect, settings.multipleShadows)],
        })
        continue
      }
      if (
        effect.kind === 'fire-ember'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireEmberLightSource(effect, presentationFrame)],
        })
        continue
      }
      if (
        effect.kind === 'fire-explosion'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        const source = nativeFireExplosionLightSource(
          effect,
          primarySpells.fireExplosionPointGain(effect.id)
            ?? pointGainAt(effect.origin),
          settings.multipleShadows,
        )
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: source === null ? [] : [source],
        })
        continue
      }
      if (
        effect.kind === 'fire-good-imp'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireGoodImpLightSource(effect, presentationFrame)],
        })
        continue
      }
      if (
        effect.kind === 'ether-impact'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [etherPrimaryImpactLightSource(effect)],
        })
        continue
      }
      if (
        effect.kind === 'fire-impact'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireImpactLightSource(effect)],
        })
        continue
      }
      if (
        effect.kind !== 'air'
        || effect.worldKey !== `boneyard:${snapshot.world.runId}`
      ) continue
      const contactLight = buildNativeAirContactLightSource({
        ageTicks: effect.ageTicks,
        endpoint: {
          x: effect.endpoint.x - effect.origin.x,
          y: effect.endpoint.y - effect.origin.y,
        },
        id: effect.id,
        origin: effect.origin,
        underpowered: effect.underpowered,
      })
      if (contactLight) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [contactLight],
        })
      }
    }
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (actor.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      const pointGain = actor.kind === 'ring-fire-explosion'
        ? (secondaryAbilities.fireExplosionPointGain(actor.id)
          ?? pointGainAt(actor.position))
        : 1
      const source = nativeSecondaryProviderLightSource(
        actor,
        presentationFrame,
        settings.multipleShadows,
        pointGain,
      )
      if (!source) continue
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          actor.lightRegistration,
          `secondary ${actor.kind} ${actor.id}`,
        ),
        sources: [source],
      })
    }
    if (lanternLight) {
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          snapshot.world.lanternLightRegistration,
          'Lantern',
        ),
        sources: [lanternLight],
      })
    }
    for (const owner of mergeNativeWorldManagerOwners(
      [lightProviderOwners],
      ({ registration }) => registration,
    )) {
      lightSourceCandidates.push(...owner.sources)
    }
    const lightProviderCandidateCount = lightSourceCandidates.length
    const lightMiscBatches = this.lightMiscBatches
    lightMiscBatches.length = 0
    const lightMiscTailCandidates = this.lightMiscTailCandidates
    lightMiscTailCandidates.length = 0
    for (const effect of snapshot.primarySpells.transients) {
      if (
        effect.kind !== 'air'
        || effect.ageTicks !== 0
        || effect.worldKey !== `boneyard:${snapshot.world.runId}`
      ) continue
      const pathSources = buildNativeAirPathLightSources({
        birthTick: effect.birthTick,
        endpoint: effect.endpoint,
        id: effect.id,
        midpoint: effect.midpoint,
        origin: effect.origin,
        weakCast: effect.underpowered,
      })
      if (pathSources.length === 0) continue
      const owner = snapshot.players[effect.ownerId]
      if (!owner) throw new Error(`Air MiscLight owner ${effect.ownerId} is unavailable`)
      lightMiscBatches.push({
        birthTick: effect.birthTick,
        id: effect.id,
        miscLightAppendOrdinal: 0,
        registration: owner.lighting.lightRegistration,
        sources: pathSources,
      })
    }
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (actor.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      const source = nativeSecondaryMiscLightSource(actor)
      if (!source) continue
      if (actor.miscLightAppendOrdinal === null) {
        throw new Error(`secondary ${actor.kind} ${actor.id} lost its MiscLight append order`)
      }
      lightMiscBatches.push({
        birthTick: snapshot.tick - actor.ageTicks,
        id: actor.id,
        miscLightAppendOrdinal: actor.miscLightAppendOrdinal,
        registration: requiredLightRegistration(
          actor.lightRegistration,
          `secondary ${actor.kind} ${actor.id}`,
        ),
        sources: [source],
      })
    }
    const enemyLightRegistrations = this.enemyLightRegistrations
    enemyLightRegistrations.clear()
    for (const enemy of snapshot.world.enemies) {
      enemyLightRegistrations.set(enemy.id, enemy.lightRegistration)
    }
    for (const batch of mageLightningPulses.pathLightBatches) {
      const miscLightAppendOrdinal = snapshot.secondaryAbilities.actors.reduce(
        (nextOrdinal, actor) => (
          actor.targetId === batch.ownerActorId
          && actor.worldKey === `boneyard:${snapshot.world.runId}`
          && nativeSecondaryMiscLightSource(actor) !== null
            ? Math.max(nextOrdinal, (actor.miscLightAppendOrdinal ?? -1) + 1)
            : nextOrdinal
        ),
        0,
      )
      lightMiscBatches.push({
        birthTick: batch.birthTick,
        id: batch.id,
        miscLightAppendOrdinal,
        registration: requiredLightRegistration(
          enemyLightRegistrations.get(batch.ownerActorId) ?? null,
          `Mage Air factory ${batch.ownerActorId}`,
        ),
        sources: batch.sources,
      })
    }
    lightMiscBatches.sort((first, second) => (
      first.miscLightAppendOrdinal - second.miscLightAppendOrdinal
      || first.birthTick - second.birthTick
      || first.id - second.id
    ))
    for (const batch of mergeNativeWorldManagerOwners(
      [lightMiscBatches],
      ({ registration }) => registration,
    )) {
      if (batch.registration.managerLane !== 'actor') {
        throw new Error('MiscLight creator is not an actor-manager owner')
      }
      lightMiscTailCandidates.push(...batch.sources)
    }
    const lightMiscTailCandidateCount = lightMiscTailCandidates.length
    const lightSources = this.index.rebuild(
      lightSourceCandidates,
      lightMiscTailCandidates,
      { camera, viewport },
      gameLightQuality(settings),
    )
    const worldLightScalar = (position: Vec2) => settings.complexLighting
      ? nativeBoneyardLightScalar(position, this.index)
      : 1
    return { dig, lanternLight, localPlayerLight, lightProviderCandidateCount,
      lightMiscTailCandidateCount, lightSources, worldLightScalar }
  }
}
