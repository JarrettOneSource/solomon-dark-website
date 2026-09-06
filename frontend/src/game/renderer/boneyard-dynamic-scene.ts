import { NativeCompactMaskView } from './native-compact-mask-view.ts'
import { NativeDeadSpiderViews } from './native-dead-spider-views.ts'
import { NativeSpiderWebViews } from './native-spider-web-views.ts'
import { NATIVE } from '../../editor/model.ts'
import { nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { Camera } from '../../editor/render.ts'
import {
  BoneyardPainterOrderPlanner,
  type DynamicPainterLayer,
  type StaticPainterLayer,
} from '../boneyard-painter-order.ts'
import type { BoneyardGateLeafSnapshot, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import { NativeBoneyardWeather } from '../core-kernels/native-boneyard-weather.ts'
import {
  type NativeSecondaryTargetEffectState,
  nativeSecondaryTargetMaterialTint,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  type BoneyardCollisionWorld,
  boneyardBodyCollides,
  createBoneyardCollisionWorld,
  withBoneyardGateCollision,
} from '../core-server/boneyard-collision.ts'
import { playerStaffActionPose } from '../player-character-presentation.ts'
import type {
  BoneyardEnemyEventSnapshot,
  BoneyardEnemySnapshot,
  GameSnapshot,
} from '../protocol/game-state.ts'
import type { NativeRegionPainterInsertion } from '../region-painter-order.ts'
import {
  BoneyardComplexShadowPresentation,
  type BoneyardComplexShadowStaticCaster,
} from './boneyard-complex-shadow-presentation.ts'
import { BoneyardGateViews } from './boneyard-gate-views.ts'
import {
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  nativeBoneyardLightScalar,
  nativeBoneyardLightTint,
  nativeBoneyardWeatherLightingOrder,
  nativeSolomonSetPieceLighting,
} from './boneyard-lighting.ts'
import { boneyardPlayerSortBias, boneyardVisibleWorldBounds } from './boneyard-render-contract.ts'
import {
  type BoneyardPainterFrame,
  type BoneyardWorldPresentationSettings,
  type BuildingResidents,
  type ResidentTexture,
  type TreeResidents,
  type WallResident,
  requireBoneyardSnapshot,
} from './boneyard-renderer-model.ts'
import { BoneyardSceneLights } from './boneyard-scene-lights.ts'
import { boneyardSolomonPainterLayers } from './boneyard-solomon-render.ts'
import { BoneyardSolomonView } from './boneyard-solomon-view.ts'
import {
  isMovingGateBody,
  nativeStaticProxyInsertions,
  runtimeMainWorldY,
} from './boneyard-static-layout.ts'
import { BoneyardStaticLighting } from './boneyard-static-lighting.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import type { NativeTreeOcclusionInput } from './boneyard-tree-occlusion.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { nativeLevelUpPresentationFrame } from './level-up-presentation.ts'
import { NativeLevelUpWorldView } from './level-up-world-view.ts'
import { modConsumableEffectId as modEffectId } from './mod-consumable-effect-presentation.ts'
import { ModConsumableEffectViews } from './mod-consumable-effect-view.ts'
import type { ModPresentationTextures } from './mod-presentation-assets.ts'
import { NativeBoneyardWeatherView } from './native-boneyard-weather-view.ts'
import {
  nativeEnemyDeathEffectPainterLane,
  nativeEnemyDeathEffectPainterLayer,
} from './native-enemy-death-effect-presentation.ts'
import { NativeEnemyDeathEffectViews } from './native-enemy-death-effect-view.ts'
import { nativeEnemyPainterLayer } from './native-enemy-presentation.ts'
import {
  nativeEnemyProjectileEffectPainterLayer,
} from './native-enemy-projectile-effect-presentation.ts'
import { NativeEnemyProjectileEffectViews } from './native-enemy-projectile-effect-view.ts'
import { NativeEnemyProjectileViews } from './native-enemy-projectile-view.ts'
import { NativeEnemyViews } from './native-enemy-view.ts'
import { NativeHagathaSeekerView } from './native-hagatha-seeker-view.ts'
import { nativeGoodiePainterLayer, nativeLootPainterLayer } from './native-loot-presentation.ts'
import { NativeGoodieViews, NativeLootViews } from './native-loot-view.ts'
import {
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET,
  NativeMageLightningPulseViews,
  nativeMageLightningTargetContactDepths,
} from './native-mage-lightning-pulse-view.ts'
import { NativeMaggotViews } from './native-maggot-view.ts'
import { nativeRegionPointGain } from '../core-kernels/native-region-point-gain.ts'
import { NativeSecondaryWorldView } from './native-secondary-world-view.ts'
import { PlayerDeathBurstViews } from './player-death-burst-view.ts'
import { PlayerDeathWeaponViews } from './player-death-weapon-view.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import { PlayerWorldView } from './world-player-view.ts'
import { Application, Container, type ContainerChild } from 'pixi.js'

export class BoneyardDynamicScene {
  private readonly compactMasks: NativeCompactMaskView
  private readonly spiderWebs: NativeSpiderWebViews
  private readonly spiderRemains: NativeDeadSpiderViews
  private readonly activeStaticPainterLayers: StaticPainterLayer[] = []
  readonly boneyard: LoadedBoneyard
  private readonly buildingResidents: ReadonlyMap<string, BuildingResidents>
  private readonly complexShadows: BoneyardComplexShadowPresentation
  private readonly collisionWorld: BoneyardCollisionWorld
  private readonly dynamicLayers: DynamicPainterLayer[] = []
  readonly enemies: NativeEnemyViews
  readonly enemyDeathEffects: NativeEnemyDeathEffectViews
  readonly enemyProjectileEffects: NativeEnemyProjectileEffectViews
  readonly enemyProjectiles: NativeEnemyProjectileViews
  private readonly gateLeaves = new Map<string, BoneyardGateLeafSnapshot>()
  private readonly gateShadowDepthOwners = new Map<string, ContainerChild>()
  private readonly gates: BoneyardGateViews
  readonly goodies: NativeGoodieViews
  readonly lights: BoneyardSceneLights
  readonly levelUp: NativeLevelUpWorldView
  private readonly livePlayerIds = new Set<string>()
  private readonly mainLayers: readonly MainLayer[]
  private readonly mainResidents: ReadonlyMap<number, ResidentTexture>
  private readonly movingGatePainterLayers: readonly StaticPainterLayer[]
  private readonly painterOrderPlanner = new BoneyardPainterOrderPlanner()
  readonly players = new Map<string, PlayerWorldView>()
  readonly playerDeathBursts: PlayerDeathBurstViews
  readonly playerDeathWeapons: PlayerDeathWeaponViews
  readonly maggots: NativeMaggotViews
  readonly loot: NativeLootViews
  readonly modEffects: ModConsumableEffectViews
  private readonly modTextures: ModPresentationTextures
  readonly mageLightningPulses: NativeMageLightningPulseViews
  readonly primarySpells: PrimarySpellWorldView
  readonly secondaryAbilities: NativeSecondaryWorldView
  private readonly secondaryEffectsByTarget = new Map<
    number,
    NativeSecondaryTargetEffectState
  >()
  readonly seeker: NativeHagathaSeekerView
  private readonly positionedDynamics = new Map<string, { row: number; zIndex: number }>()
  private readonly root: Container
  readonly solomon: BoneyardSolomonView | null
  private readonly staticPainterLayers: StaticPainterLayer[]
  private readonly textures: BoneyardWorldTextures
  private readonly staticLighting: BoneyardStaticLighting
  private readonly treeResidents: ReadonlyMap<string, TreeResidents>
  private readonly wallResidents: ReadonlyMap<number, WallResident>
  private readonly visibleShadowDepthOwners: ContainerChild[] = []
  readonly weather: NativeBoneyardWeather
  readonly weatherView: NativeBoneyardWeatherView
  visibleEnemyFamilies = ''

  private readonly renderer: Application['renderer']

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    renderer: Application['renderer'],
    textures: BoneyardWorldTextures,
    mainLayers: readonly MainLayer[],
    mainResidents: ReadonlyMap<number, ResidentTexture>,
    shadowCasters: readonly BoneyardComplexShadowStaticCaster[],
    treeInputs: readonly NativeTreeOcclusionInput[],
    treeResidents: ReadonlyMap<string, TreeResidents>,
    buildingResidents: ReadonlyMap<string, BuildingResidents>,
    wallResidents: ReadonlyMap<number, WallResident>,
    initialSnapshot: GameSnapshot,
    modTextures: ModPresentationTextures,
    modCatalog: readonly ModConsumableCatalogEntry[],
  ) {
    this.boneyard = boneyard
    this.renderer = renderer
    this.collisionWorld = createBoneyardCollisionWorld(boneyard.scene)
    this.lights = new BoneyardSceneLights(boneyard)
    this.root = root
    this.textures = textures
    this.modTextures = modTextures
    this.mainLayers = mainLayers
    this.mainResidents = mainResidents
    this.complexShadows = new BoneyardComplexShadowPresentation(root, shadowCasters)
    this.staticLighting = new BoneyardStaticLighting(
      boneyard, mainLayers, buildingResidents, wallResidents, treeResidents,
      treeInputs, initialSnapshot.tick,
    )
    this.treeResidents = treeResidents
    this.buildingResidents = buildingResidents
    this.wallResidents = wallResidents
    const preWorld = new Container({ label: 'boneyard-direct-pre-world' })
    preWorld.eventMode = 'none'
    preWorld.sortableChildren = true
    preWorld.zIndex = NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX / 2
    root.addChild(preWorld)
    this.primarySpells = PrimarySpellWorldView.forBoneyard(root, textures, { preWorldRoot: preWorld })
    this.secondaryAbilities = new NativeSecondaryWorldView(root, textures, renderer, {
      preWorldRoot: preWorld,
    })
    this.staticPainterLayers = mainLayers.map((layer, layerIndex) => ({
      layerIndex,
      worldY: layer.worldY,
      sortBias: layer.sortBias,
      sourceOrder: layer.sourceOrder,
      insertions: nativeStaticProxyInsertions(layer),
    }))
    this.movingGatePainterLayers = this.staticPainterLayers.filter((layer) => (
      isMovingGateBody(this.mainLayers[layer.layerIndex])
    ))
    this.gates = new BoneyardGateViews(root, textures)
    this.goodies = new NativeGoodieViews(root, textures)
    this.compactMasks = new NativeCompactMaskView(root, preWorld, renderer, textures, boneyard.scene)
    this.spiderRemains = new NativeDeadSpiderViews(preWorld, textures)
    this.spiderWebs = new NativeSpiderWebViews(root)
    this.enemies = new NativeEnemyViews(root, textures, preWorld)
    this.enemyDeathEffects = new NativeEnemyDeathEffectViews(root, textures, preWorld)
    this.enemyProjectileEffects = new NativeEnemyProjectileEffectViews(root, textures, preWorld)
    this.enemyProjectiles = new NativeEnemyProjectileViews(root, textures, preWorld)
    this.maggots = new NativeMaggotViews(root, textures)
    this.loot = new NativeLootViews(root, textures, modTextures, modCatalog)
    this.seeker = new NativeHagathaSeekerView(root)
    this.modEffects = new ModConsumableEffectViews(root, textures)
    this.mageLightningPulses = new NativeMageLightningPulseViews(
      root,
      textures.primarySpells.air,
    )
    this.playerDeathBursts = new PlayerDeathBurstViews(root, textures, initialSnapshot)
    this.playerDeathWeapons = new PlayerDeathWeaponViews(root, textures, initialSnapshot)
    this.levelUp = new NativeLevelUpWorldView(textures.levelUpSparkle)
    root.addChild(this.levelUp.container)
    this.weather = new NativeBoneyardWeather({
      enhancedEffects: true,
      initialTick: initialSnapshot.tick,
      mode: boneyard.scene.environmentMode,
    })
    this.weatherView = new NativeBoneyardWeatherView(
      root,
      textures.weatherSplash,
      this.weather,
    )
    this.solomon = boneyard.scene.solomonDig
      ? new BoneyardSolomonView(boneyard, root, textures)
      : null
  }

  consumeEnemyEvent(event: BoneyardEnemyEventSnapshot): void {
    this.enemies.consumeEvent(event)
  }

  update(
    snapshot: GameSnapshot,
    localPlayerId: string,
    presentationFrame: number,
    visibleMainResidents: readonly ResidentTexture[],
    levelUpPresentation: {
      elapsedMs: number
      playerScreenY: number
      presentationId: number
    } | null,
    camera: Camera,
    viewport: GameViewportLayout,
    settings: BoneyardWorldPresentationSettings,
  ): BoneyardPainterFrame {
    requireBoneyardSnapshot(snapshot, this.boneyard.runId)
    const enemySnapshots = nativeEnemySnapshots(snapshot)
    const livePlayerIds = this.livePlayerIds
    livePlayerIds.clear()
    const materializingPlayerIds = new Set(snapshot.materializingPlayerIds)
    for (const playerId in snapshot.players) {
      if (materializingPlayerIds.has(playerId)) continue
      const player = snapshot.players[playerId]
      livePlayerIds.add(playerId)
      let view = this.players.get(playerId)
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures, this.modTextures, this.renderer, true)
        this.players.set(playerId, view)
        this.root.addChild(view.container)
      }
      view.setStatusEffects(snapshot.secondaryAbilities.players[playerId], snapshot.tick, snapshot.world.webbedPlayers[playerId])
      view.update(
        player,
        snapshot.tick,
        playerStaffActionPose(
          snapshot.primarySpells.transients,
          playerId,
          `boneyard:${this.boneyard.runId}`,
        ),
      )
    }
    for (const [playerId, view] of this.players) {
      if (livePlayerIds.has(playerId)) continue
      this.root.removeChild(view.container)
      view.destroy()
      this.players.delete(playerId)
    }
    const localPlayer = snapshot.players[localPlayerId]
    if (!localPlayer) throw new Error('Boneyard renderer lost its local player.')
    const weatherBounds = boneyardVisibleWorldBounds(camera, viewport, 0)
    const pointGainAt = (position: Readonly<{ x: number, y: number }>): number => (
      nativeRegionPointGain(
        position,
        { x: camera.x, y: camera.y },
        weatherBounds.w,
        localPlayer.progression.lifeState !== 'alive',
      )
    )
    const weatherCollisionWorld = withBoneyardGateCollision(
      this.collisionWorld,
      snapshot.world.gateLeaves,
    )
    this.weather.advanceTo(
      snapshot.tick,
      weatherBounds,
      viewport.height / camera.zoom,
      (position, radius) => boneyardBodyCollides(
        position,
        weatherCollisionWorld,
        radius,
      ),
    )
    const levelUpFrame = levelUpPresentation === null
      ? null
      : nativeLevelUpPresentationFrame(
          levelUpPresentation.presentationId,
          levelUpPresentation.elapsedMs,
          levelUpPresentation.playerScreenY,
        )
    this.primarySpells.update(
      snapshot.primarySpells,
      `boneyard:${snapshot.world.runId}`,
      presentationFrame,
      pointGainAt,
    )
    this.secondaryAbilities.update(
      snapshot.secondaryAbilities,
      `boneyard:${snapshot.world.runId}`,
      presentationFrame,
      pointGainAt,
    )
    this.gates.update(snapshot.world.gateLeaves)
    this.goodies.update(snapshot.world.goodies, snapshot.tick)
    this.enemies.update(enemySnapshots, snapshot.tick)
    this.spiderRemains.update(snapshot.world.spiderRemains)
    const visibleWorldBounds = boneyardVisibleWorldBounds(camera, viewport)
    this.enemyDeathEffects.update(
      snapshot.world.deathEffects,
      visibleWorldBounds,
    )
    this.enemyProjectileEffects.update(snapshot.world.enemyProjectileEffects, pointGainAt)
    this.enemyProjectiles.update(snapshot.world.enemyProjectiles, snapshot.tick)
    this.maggots.update(snapshot.world.maggots, visibleWorldBounds)
    const visibleMaggots = this.maggots.visibleSnapshots
    this.loot.update(snapshot.world.loot)
    this.seeker.update(snapshot, localPlayerId)
    this.modEffects.update(snapshot)
    this.mageLightningPulses.update(
      snapshot.world.mageLightningPulses,
      snapshot.tick,
      (playerId) => snapshot.players[playerId]?.position ?? null,
    )
    const mageLightningPainterLayers = this.mageLightningPulses.painterLayers()
    this.playerDeathBursts.update(snapshot)
    this.playerDeathWeapons.update(snapshot)
    this.visibleEnemyFamilies = [...new Set(
      enemySnapshots.map((enemy) => enemy.enemyToken),
    )].sort().join(',')
    const lanternPosition = snapshot.world.lanternPosition
    this.solomon?.update(snapshot.world.encounter, snapshot.tick, lanternPosition)

    const { dig, lanternLight, localPlayerLight, lightProviderCandidateCount,
      lightMiscTailCandidateCount, lightSources, worldLightScalar } = this.lights.update(
        snapshot, localPlayerId, presentationFrame, settings, levelUpFrame, camera,
        viewport, this.primarySpells, this.secondaryAbilities, this.mageLightningPulses,
        pointGainAt,
      )
    this.spiderWebs.update(snapshot.world.spiderSilks, snapshot.world.silkFragments, presentationFrame, worldLightScalar)
    this.weatherView.update(worldLightScalar)
    const { maxMainLightScalar, minMainLightScalar, monumentVisibleCount, buildingBaseRoofColorMismatchCount, buildingVertexLightMaximum, buildingVertexLightMinimum, buildingVisibleCount, wallVertexLightMaximum, wallVertexLightMinimum, wallVisibleCount, fadedTreeCount, minTreeAlpha, minTreeLightScalar, treeAlphaMismatchCount, treeTintMismatchCount, treePresentations } = this.staticLighting.update(
      snapshot, localPlayer.position, visibleMainResidents, settings.complexLighting,
      this.lights.index, worldLightScalar,
    )
    for (const [id, view] of this.players) {
      const player = snapshot.players[id]
      if (!player) continue
      view.setWorldTint(nativeBoneyardLightTint(worldLightScalar(player.position)))
    }
    const playerDeathWeaponPainterLayers = this.playerDeathWeapons.painterLayers()
    const primarySpellPainterLayers = this.primarySpells.painterLayers()
    const secondaryAbilityPainterLayers = this.secondaryAbilities.painterLayers()
    for (const layer of playerDeathWeaponPainterLayers) {
      this.playerDeathWeapons.setTint(
        layer.playerId,
        nativeBoneyardLightTint(worldLightScalar(layer.position)),
      )
    }
    for (const layer of primarySpellPainterLayers) {
      if (!layer.regionLightPoint) continue
      this.primarySpells.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    for (const layer of secondaryAbilityPainterLayers) {
      if (!layer.regionLightPoint) continue
      this.secondaryAbilities.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    const secondaryEffectsByTarget = this.secondaryEffectsByTarget
    secondaryEffectsByTarget.clear()
    for (const effect of snapshot.secondaryAbilities.targetEffects) {
      if (effect.worldKey === `boneyard:${snapshot.world.runId}`) {
        secondaryEffectsByTarget.set(effect.targetId, effect)
      }
    }
    for (const enemy of enemySnapshots) {
      const lightTint = nativeBoneyardLightTint(worldLightScalar(enemy.position))
      this.enemies.setTint(enemy.id, nativeSecondaryTargetMaterialTint(
        lightTint,
        secondaryEffectsByTarget.get(enemy.id),
      ))
    }
    for (const actor of snapshot.world.loot) {
      this.loot.setTint(actor.id, nativeBoneyardLightTint(worldLightScalar(actor.position)))
    }
    for (const effect of snapshot.modEffects) {
      const player = snapshot.players[effect.playerId]
      if (!player) continue
      this.modEffects.setTint(modEffectId(effect), nativeBoneyardLightTint(
        nativeBoneyardLightScalar(player.position, this.lights.index),
      ))
    }
    for (const goodie of snapshot.world.goodies) {
      this.goodies.setTint(
        goodie.id,
        nativeBoneyardLightTint(worldLightScalar(goodie.position)),
      )
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      this.enemyProjectiles.setTint(
        projectile.id,
        nativeBoneyardLightTint(worldLightScalar(projectile.position)),
      )
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      this.enemyProjectileEffects.setWorldTint(
        effect.id,
        nativeBoneyardLightTint(worldLightScalar(effect.position)),
      )
    }
    for (const maggot of visibleMaggots) {
      this.maggots.setTint(
        maggot.id,
        nativeBoneyardLightTint(worldLightScalar(maggot.position)),
      )
    }
    for (const leaf of snapshot.world.gateLeaves) {
      const position = nativeGatePainterRoot(leaf.hinge, leaf.tip)
      this.gates.setTint(
        leaf.fenceEid,
        leaf.side,
        nativeBoneyardLightTint(worldLightScalar(position)),
      )
    }
    if (dig && lanternPosition) {
      const solomonPosition = snapshot.world.encounter?.position ?? dig.position
      this.solomon?.setLighting(settings.complexLighting
        ? nativeSolomonSetPieceLighting(
            solomonPosition,
            lanternPosition,
            this.lights.index,
          )
        : { bodyTint: 0xffffff, dirtTint: 0xffffff, lanternTint: 0xffffff })
    }

    const gateLeaves = this.gateLeaves
    gateLeaves.clear()
    for (const leaf of snapshot.world.gateLeaves) {
      gateLeaves.set(`${leaf.fenceEid}:${leaf.side}`, leaf)
    }
    const dynamicLayers = this.dynamicLayers
    dynamicLayers.length = 0
    const enemyAuxiliaryPainterLayers = this.enemies.painterLayers()
    for (const playerId in snapshot.players) {
      if (materializingPlayerIds.has(playerId)) continue
      const player = snapshot.players[playerId]
      dynamicLayers.push({
        id: `player:${playerId}`,
        queueFamily: 'ordinary-dynamic',
        registration: player.lighting.lightRegistration,
        worldY: player.position.y,
        sortBias: boneyardPlayerSortBias(player),
      })
    }
    for (const layer of playerDeathWeaponPainterLayers) {
      const playerId = layer.id.slice('player-death-weapon:'.length)
      const registration = snapshot.players[playerId]
        ?.lighting.deathWeaponPainterRegistration
      if (!registration) {
        throw new Error(`death weapon ${playerId} lost its painter registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        queueFamily: 'ordinary-dynamic',
        registration,
        worldY: layer.worldY,
        sortBias: 0,
      })
    }
    for (const layer of primarySpellPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      dynamicLayers.push(layer as DynamicPainterLayer)
    }
    for (const layer of mageLightningPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null || layer.registration === undefined) {
        throw new Error(`Mage lightning painter ${layer.id} lost its registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        insertions: layer.insertions,
        queueFamily: layer.queueFamily,
        registration: layer.registration,
        worldY: layer.worldY,
        sortBias: layer.sortBias,
        visible: layer.visible,
      })
    }
    for (const layer of secondaryAbilityPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null || layer.registration === undefined) {
        throw new Error(`secondary painter ${layer.id} lost its manager registration`)
      }
      dynamicLayers.push(layer as DynamicPainterLayer)
    }
    for (const enemy of enemySnapshots) {
      dynamicLayers.push(nativeEnemyPainterLayer(enemy))
    }
    for (const actor of snapshot.world.loot) {
      dynamicLayers.push(nativeLootPainterLayer(actor))
    }
    for (const goodie of snapshot.world.goodies) {
      dynamicLayers.push(nativeGoodiePainterLayer(goodie))
    }
    for (const effect of snapshot.world.deathEffects) {
      if (!this.enemyDeathEffects.isVisible(effect.id)) continue
      if (nativeEnemyDeathEffectPainterLane(effect) !== 'world-sorted') continue
      dynamicLayers.push(nativeEnemyDeathEffectPainterLayer(effect))
    }
    for (const silk of snapshot.world.spiderSilks) {
      dynamicLayers.push({
        id: `silk:${silk.id}`, queueFamily: 'ordinary-dynamic',
        registration: silk.painterRegistration, worldY: silk.state.position.y, sortBias: 0,
      })
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      if (projectile.kind === 'poison-pool') continue
      dynamicLayers.push({
        id: `enemy-projectile:${projectile.id}`,
        queueFamily: 'ordinary-dynamic',
        registration: projectile.painterRegistration,
        worldY: projectile.position.y,
        sortBias: 0,
      })
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      const layer = nativeEnemyProjectileEffectPainterLayer(effect)
      if (layer) dynamicLayers.push(layer)
    }
    for (const layer of enemyAuxiliaryPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null) {
        throw new Error(`enemy auxiliary painter ${layer.id} lost its registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        queueFamily: layer.queueFamily,
        registration: layer.registration,
        worldY: layer.worldY,
        sortBias: layer.sortBias,
      })
    }
    for (const maggot of visibleMaggots) {
      dynamicLayers.push({
        id: `maggot:${maggot.id}`,
        queueFamily: 'ordinary-dynamic',
        registration: maggot.lightRegistration,
        worldY: maggot.position.y,
        sortBias: 0,
      })
    }
    if (dig) {
      if (
        snapshot.world.lanternLightRegistration === null
        || snapshot.world.solomonPainterRegistration === null
      ) {
        throw new Error('Solomon set piece lost its native painter registrations')
      }
      dynamicLayers.push(...boneyardSolomonPainterLayers(
        dig,
        snapshot.world.encounter,
        snapshot.world.lanternLightRegistration,
        snapshot.world.solomonPainterRegistration,
        lanternPosition,
      ))
    }
    const activeStaticPainterLayers = this.activeStaticPainterLayers
    activeStaticPainterLayers.length = 0
    const visibleShadowDepthOwners = this.visibleShadowDepthOwners
    visibleShadowDepthOwners.length = 0
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const mainLayer = this.mainLayers[layerIndex]
      if (mainLayer.kind === 'object' && mainLayer.object.typeId === NATIVE.goodie) {
        continue
      }
      const layer = this.staticPainterLayers[layerIndex]!
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
      if (resident.shadowCaster) visibleShadowDepthOwners.push(resident.sprite)
    }
    for (const layer of this.movingGatePainterLayers) {
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
    }
    const order = this.painterOrderPlanner.build({
      referenceY: localPlayer.position.y,
      staticLayers: activeStaticPainterLayers,
      dynamicLayers,
    })
    let maxMainZIndex = 0
    let minMainZIndex = Number.POSITIVE_INFINITY
    const gateShadowDepthOwners = this.gateShadowDepthOwners
    gateShadowDepthOwners.clear()
    for (const band of order.bands) {
      band.layerIndexes.forEach((layerIndex, position) => {
        const depth = band.zIndex + ((position + 1) / (band.layerIndexes.length + 1)) * 0.5
        maxMainZIndex = Math.max(maxMainZIndex, depth)
        minMainZIndex = Math.min(minMainZIndex, depth)
        const resident = this.mainResidents.get(layerIndex)
        if (resident?.sprite.renderable) resident.sprite.zIndex = depth
        const layer = this.mainLayers[layerIndex]
        if (isMovingGateBody(layer)) {
          this.gates.setDepth(layer.fence.eid, layer.pieceIndex, depth)
          const depthOwner = this.gates.depthOwner(layer.fence.eid, layer.pieceIndex)
          if (depthOwner) {
            gateShadowDepthOwners.set(
              `${layer.fence.eid}:${layer.pieceIndex}`,
              depthOwner,
            )
          }
        }
      })
    }
    const positionedDynamics = this.positionedDynamics
    positionedDynamics.clear()
    let maxDynamicZIndex = 0
    for (const layer of order.dynamicLayers) {
      positionedDynamics.set(layer.id, layer)
      maxDynamicZIndex = Math.max(maxDynamicZIndex, layer.zIndex)
      if (layer.id.startsWith('mage-lightning:')) {
        this.mageLightningPulses.setDepth(layer.id, layer.zIndex)
      }
    }
    for (const layer of order.proxyLayers) {
      if (layer.id.startsWith('proxy:tree:')) {
        const resident = this.treeResidents.get(layer.id.slice('proxy:tree:'.length))
        if (resident) resident.proxy.sprite.zIndex = layer.zIndex
      } else if (layer.id.startsWith('proxy:building:')) {
        const resident = this.buildingResidents.get(
          layer.id.slice('proxy:building:'.length),
        )
        if (resident) resident.roof.sprite.zIndex = layer.zIndex
      }
    }
    for (const [id, view] of this.players) {
      const depth = positionedDynamics.get(`player:${id}`)?.zIndex ?? 1
      view.setDepth(depth)
      this.playerDeathBursts.setDepth(id, depth)
      this.playerDeathWeapons.setDepth(
        id,
        positionedDynamics.get(`player-death-weapon:${id}`)?.zIndex ?? depth,
      )
    }
    this.seeker.setDepth(
      (positionedDynamics.get(`player:${localPlayerId}`)?.zIndex ?? 1) + 0.25,
    )
    this.primarySpells.applyBoneyardPainterDepths(
      order.dynamicLayers,
      order.foregroundZIndex + 0.5,
    )
    const targetContactDepths = nativeMageLightningTargetContactDepths(
      mageLightningPainterLayers,
      Object.keys(snapshot.players),
      order.foregroundZIndex,
    )
    for (const layer of mageLightningPainterLayers) {
      layer.container.zIndex = layer.lane === 'post-main-overlay'
        ? targetContactDepths.get(layer.id) ?? (
            order.foregroundZIndex + NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET
          )
        : positionedDynamics.get(layer.id)?.zIndex ?? 1
    }
    this.primarySpells.promoteOwnerOverlays((ownerId) => (
      positionedDynamics.get(`player:${ownerId}`)?.zIndex
    ))
    for (const layer of secondaryAbilityPainterLayers) {
      this.secondaryAbilities.setDepth(
        layer.id,
        layer.lane === 'pre-world-queue'
          ? 0.5
          : positionedDynamics.get(layer.id)?.zIndex ?? 1,
      )
      applyInsertedPainterDepths(
        layer.insertions,
        positionedDynamics,
        (id, depth) => this.secondaryAbilities.setDepth(id, depth),
      )
    }
    for (const enemy of enemySnapshots) {
      this.enemies.setDepth(
        enemy.id,
        positionedDynamics.get(`enemy:${enemy.id}`)?.zIndex ?? 1,
      )
    }
    for (const layer of enemyAuxiliaryPainterLayers) {
      const depth = layer.lane === 'pre-world-queue'
        ? 0.5
        : layer.lane === 'post-world-queue'
          ? order.foregroundZIndex + 0.25
          : positionedDynamics.get(layer.id)?.zIndex ?? 1
      this.enemies.setAuxiliaryEffectDepth(layer.eventId, depth)
    }
    for (const actor of snapshot.world.loot) {
      this.loot.setDepth(
        actor.id,
        positionedDynamics.get(`loot:${actor.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.modEffects) {
      const id = modEffectId(effect)
      this.modEffects.setDepth(
        id,
        order.foregroundZIndex + 0.75,
      )
    }
    for (const goodie of snapshot.world.goodies) {
      this.goodies.setDepth(
        goodie.id,
        positionedDynamics.get(`goodie:${goodie.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.world.deathEffects) {
      if (!this.enemyDeathEffects.isVisible(effect.id)) continue
      const lane = nativeEnemyDeathEffectPainterLane(effect)
      this.enemyDeathEffects.setDepth(
        effect.id,
        lane === 'pre-world-queue'
          ? 0.5
          : lane === 'post-world-queue'
            ? order.foregroundZIndex + 0.25
            : positionedDynamics.get(`enemy-death-effect:${effect.id}`)?.zIndex ?? 1,
      )
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      this.enemyProjectiles.setDepth(
        projectile.id,
        positionedDynamics.get(`enemy-projectile:${projectile.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      this.enemyProjectileEffects.setDepth(
        effect.id,
        effect.kind === 'demon-explosion-core' ? order.foregroundZIndex + 0.25
          : effect.kind === 'demon-explosion-array' || effect.kind === 'poison-bubble' ? 0.5
            : positionedDynamics.get(`enemy-projectile-effect:${effect.id}`)?.zIndex ?? 1,
      )
    }
    for (const maggot of visibleMaggots) {
      this.maggots.setDepth(
        maggot.id,
        positionedDynamics.get(`maggot:${maggot.id}`)?.zIndex ?? 1,
      )
    }
    for (const silk of snapshot.world.spiderSilks) {
      this.spiderWebs.setSilkDepth(silk.id, positionedDynamics.get(`silk:${silk.id}`)?.zIndex ?? 1)
    }
    const solomonPainter = positionedDynamics.get('solomon-actor')
    const lanternPainter = positionedDynamics.get('lantern')
    this.solomon?.setActorDepth(solomonPainter?.zIndex ?? 1)
    this.solomon?.setLanternDepth(lanternPainter?.zIndex ?? 1)
    this.spiderWebs.setFragmentDepth(order.foregroundZIndex + 0.25)
    this.compactMasks.update(
      Object.fromEntries(Object.entries(snapshot.players).filter(([id]) => !materializingPlayerIds.has(id))),
      snapshot.world.spiderRemains,
      snapshot.world.arenaTransition?.phase === 'sealed'
        ? snapshot.world.arenaTransition.combatBounds : this.boneyard.scene.bounds,
      presentationFrame, order.foregroundZIndex + 1,
    )
    const weatherLightingOrder = nativeBoneyardWeatherLightingOrder(
      order.foregroundZIndex,
      settings.complexLighting,
    )
    this.weatherView.setDepth(weatherLightingOrder)
    const complexShadows = this.complexShadows.render(
      this.lights.index,
      presentationFrame,
      snapshot.world.gateLeaves,
      gateShadowDepthOwners,
      visibleShadowDepthOwners,
      settings.complexLighting && settings.complexShadows,
    )
    const localPainter = positionedDynamics.get(`player:${localPlayerId}`)
    const localPlayerZIndex = localPainter?.zIndex ?? 1
    this.levelUp.update(
      levelUpFrame,
      localPlayer.position,
      localPlayerZIndex + 0.1,
    )
    return {
      activeStaticPainterLayerCount: activeStaticPainterLayers.length,
      buildingBaseRoofColorMismatchCount,
      buildingCount: this.buildingResidents.size,
      buildingVertexLightMaximum,
      buildingVertexLightMinimum: buildingVisibleCount > 0
        ? buildingVertexLightMinimum
        : 0,
      buildingVisibleCount,
      complexShadowActiveMeshCount: complexShadows.activeMeshCount,
      complexShadowAllocatedQuadCapacity: complexShadows.allocatedQuadCapacity,
      complexShadowCasterCount: complexShadows.casterCount,
      complexShadowPooledMeshCount: complexShadows.pooledMeshCount,
      complexShadowQuadCount: complexShadows.quadCount,
      complexShadowRecordCount: complexShadows.recordCount,
      complexShadowZOrderMismatchCount: complexShadows.zOrderMismatchCount,
      fadedTreeCount,
      foregroundZIndex: order.foregroundZIndex,
      localPlayerPainterRow: localPainter?.row ?? 0,
      localPlayerZIndex,
      lanternLightIntensity: lanternLight?.intensity ?? 0,
      lanternWorldX: this.solomon?.lanternWorldX ?? Number.NaN,
      lanternWorldY: this.solomon?.lanternWorldY ?? Number.NaN,
      lanternLightX: lanternLight?.position.x ?? Number.NaN,
      lanternLightY: lanternLight?.position.y ?? Number.NaN,
      lanternPainterRow: lanternPainter?.row ?? Number.NaN,
      lanternZIndex: lanternPainter?.zIndex ?? Number.NaN,
      lightMiscTailCandidateCount,
      lightActiveBucketCount: this.lights.index.activeBucketCount,
      lightAllocatedBucketCount: this.lights.index.allocatedBucketCount,
      lightIndexedSourceReferenceCount: this.lights.index.indexedSourceReferenceCount,
      lightProviderCandidateCount,
      lightSourceCount: lightSources.length,
      mainAboveLocal: maxMainZIndex > localPlayerZIndex,
      mainBelowLocal: minMainZIndex < localPlayerZIndex,
      maxDynamicZIndex,
      maxMainLightScalar,
      maxMainZIndex,
      minMainLightScalar: visibleMainResidents.length > 0 ? minMainLightScalar : 0,
      minTreeAlpha,
      minTreeLightScalar: treePresentations.length > 0 ? minTreeLightScalar : 0,
      monumentVisibleCount,
      painterBandCount: order.bands.length,
      painterOrder: order.orderedLayers,
      painterProxyOrder: order.proxyLayers,
      playerLightRadius: localPlayerLight?.radius ?? 0,
      playerLightRasterRadius: localPlayerLight?.rasterScale ?? 0,
      treeAlphaMismatchCount,
      treeCount: treePresentations.length,
      treeProxyResidentCount: this.treeResidents.size,
      treeTintMismatchCount,
      solomonPainterRow: solomonPainter?.row ?? Number.NaN,
      solomonZIndex: solomonPainter?.zIndex ?? Number.NaN,
      weatherLightingOrder,
      wallCount: this.wallResidents.size,
      wallVertexLightMaximum,
      wallVertexLightMinimum: wallVisibleCount > 0 ? wallVertexLightMinimum : 0,
      wallVisibleCount,
    }
  }

  enemyBodyEntry(id: number): number | null {
    return this.enemies.bodyEntry(id)
  }

  enemyLimbsEntry(id: number): number | null {
    return this.enemies.limbsEntry(id)
  }

  enemyScale(id: number): number | null {
    return this.enemies.scale(id)
  }

  player(playerId: string): PlayerWorldView | undefined {
    return this.players.get(playerId)
  }

  playerWalkPose(playerId: string): number {
    return this.players.get(playerId)?.walkPose ?? 0
  }

  destroy(): void {
    this.painterOrderPlanner.clear()
    this.complexShadows.destroy()
    this.primarySpells.destroy()
    this.secondaryAbilities.destroy()
    this.compactMasks.destroy()
    this.spiderWebs.destroy()
    this.spiderRemains.destroy()
    this.enemies.destroy()
    this.enemyDeathEffects.destroy()
    this.enemyProjectileEffects.destroy()
    this.enemyProjectiles.destroy()
    this.maggots.destroy()
    this.loot.destroy()
    this.seeker.destroy()
    this.modEffects.destroy()
    this.goodies.destroy()
    this.mageLightningPulses.destroy()
    this.playerDeathBursts.destroy()
    this.playerDeathWeapons.destroy()
    this.root.removeChild(this.levelUp.container)
    this.levelUp.destroy()
    this.gates.destroy()
    this.weatherView.destroy()
    this.solomon?.destroy()
    for (const view of this.players.values()) view.destroy()
    this.players.clear()
  }
}

function applyInsertedPainterDepths(
  insertions: readonly NativeRegionPainterInsertion[] | undefined,
  positioned: ReadonlyMap<string, { row: number; zIndex: number }>,
  setDepth: (id: string, depth: number) => void,
): void {
  for (const insertion of insertions ?? []) {
    const layer = positioned.get(insertion.id)
    if (!layer) {
      throw new Error(`inserted native painter ${insertion.id} lost its queue depth`)
    }
    setDepth(insertion.id, layer.zIndex)
    applyInsertedPainterDepths(insertion.insertions, positioned, setDepth)
  }
}

function nativeEnemySnapshots(snapshot: GameSnapshot): readonly BoneyardEnemySnapshot[] {
  return snapshot.world.kind === 'boneyard' ? snapshot.world.enemies : []
}
