import { Container, Sprite, type Renderer, type Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import { playerStaffActionPose } from '../player-character-presentation.ts'
import {
  HUB_ASTRONOMER_ROOT,
  HUB_ASTRONOMER_TELESCOPE_ORIGIN,
  HUB_SOUTHERN_EAST_PLATFORM_ORIGIN,
  HUB_SOUTHERN_EXTENT,
  HUB_SOUTHERN_WEST_PLATFORM_ORIGIN,
} from '../hub-camera-presentation.ts'
import {
  createHubAstronomerClock,
  type HubAstronomerAssistantFrame,
  type HubAstronomerMainActorFrame,
} from '../hub-astronomer.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
  type NativeHubInteractionId,
} from '../core-kernels/native-hub-npc.ts'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  createHubCommonTraderClock,
  createHubHagathaClock,
  createHubPotionTraderClock,
  hubFountainParticleAlpha,
  hubSealColors,
  hubStatueOffsets,
  type HubColor,
  type HubCommonTraderClock,
  type HubHagathaClock,
  type HubHagathaParticle,
} from '../hub-presentation.ts'
import {
  NativeHubPainterPlanner,
  nativeHubFixedActorPainterRegistration,
  type NativeHubPainterLayer,
} from '../hub-painter-order.ts'
import {
  HUB_TEACHER_CAST_ORIGIN,
  HUB_TEACHER_RUNE_ALPHA,
  HUB_TEACHER_RUNE_CENTER,
  hubTeacherBurstAt,
  hubTeacherFrameAt,
  type HubTeacherBurstPresentation,
} from '../hub-teacher.ts'
import { PlayerWorldView, HubStudentView, actorSprite } from './hub-actors.ts'
import {
  HUB_COURTYARD_OBSTACLES,
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  hubWorldDepthForActor,
  hubStudentIntersectsView,
  spriteFrameIndex,
} from './hub-render-contract.ts'
import {
  NATIVE_HUB_COLLEGE_STATUE,
  nativeCourtyardPlayerSortBias,
} from '../core-kernels/native-hub-world-membership.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import type { ModPresentationTextures } from './mod-presentation-assets.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import { nativeLevelUpPresentationFrame } from './level-up-presentation.ts'
import { NativeLevelUpWorldView } from './level-up-world-view.ts'
import { NativeSecondaryWorldView } from './native-secondary-world-view.ts'
import type { ProtocolHubSkorchaState } from '../protocol/game-state.ts'
import {
  captureHubNpcMarkerSuppression,
  hubNpcMarkerFrame,
  hubNpcOnboardingPlan,
  type HubNpcMarkerSuppression,
  type HubNpcMarkerSurface,
} from './hub-npc-marker-presentation.ts'
import {
  courtyardMarkerSource,
  HubWalkToTalkView,
} from './hub-npc-marker-view.ts'
import {
  HUB_NPC_MARKER_TAIL_OFFSET,
  HUB_USEFUL_THYNGS_CHILD_DEPTH,
} from '../hub-depth.ts'

export class HubWorldScene {
  readonly stage = new Container({ label: 'college-courtyard-camera-banks' })
  readonly world = new Container({ isRenderGroup: true, label: 'college-courtyard' })
  readonly southern = new Container({
    isRenderGroup: true,
    label: 'college-courtyard-southern-bank',
  })
  private readonly sealGlyphs: Sprite
  private readonly sealCore: Sprite
  private readonly markerSprites = new Map<NativeHubInteractionId, Sprite>()
  private readonly modTextures: ModPresentationTextures
  private readonly nonPlayerActors: Container[] = []
  private readonly courtyardObstacles: Array<{
    obstacle: typeof HUB_COURTYARD_OBSTACLES[number]
    sprite: Sprite
  }> = []
  private readonly fountain = new Map<number, Sprite>()
  private readonly liveFountainIds = new Set<number>()
  private readonly statueAura: Sprite
  private readonly statueBody: Sprite
  private readonly usefulThyngsBack: Sprite
  private readonly usefulThyngsFront: Sprite
  private readonly usefulThyngsShadow: Sprite
  private readonly usefulThyngsStack = new Container({ label: 'useful-thyngs-stack' })
  private readonly astronomer: HubAstronomerView
  private readonly hagatha: HubHagathaView
  private readonly luthacus: HubCommonTraderView
  private readonly potion: HubPotionTraderView
  private readonly skorcha: HubSkorchaView
  private readonly teacher: HubTeacherView
  private readonly players = new Map<string, PlayerWorldView>()
  private readonly playerElements = new Map<string, WizardElement>()
  private readonly primarySpells: PrimarySpellWorldView
  private readonly levelUp: NativeLevelUpWorldView
  private readonly secondaryAbilities: NativeSecondaryWorldView
  private readonly livePlayerIds = new Set<string>()
  private readonly students = new Map<number, HubStudentView>()
  private readonly retiredStudentViews: HubStudentView[] = []
  private readonly liveStudentIds = new Set<number>()
  private readonly southernArchitecture: Sprite[] = []
  private readonly textures: HubWorldTextures
  private readonly walkToTalk: HubWalkToTalkView
  private createdStudentViewCount = 0
  private reusedStudentViewCount = 0
  private markerSuppression: HubNpcMarkerSuppression = [false, false, false]
  private markerSuppressionInitialized = false
  private markerEpochSeed = 0
  private markerEpochStartedAtTick = 0
  private lastLocalRegion: string | null = null
  private readonly painterPlanner = new NativeHubPainterPlanner()
  private lastPainterOrder: readonly Readonly<{ id: string; row: number; zIndex: number }>[] = []

  private readonly renderer: Renderer

  constructor(
    textures: HubWorldTextures,
    createdAtTick: number,
    traderAnimationSeed: number,
    renderer: Renderer,
    modTextures: ModPresentationTextures,
  ) {
    this.textures = textures
    this.renderer = renderer
    this.modTextures = modTextures
    this.stage.eventMode = 'none'
    this.world.sortableChildren = true
    this.world.eventMode = 'none'
    this.southern.sortableChildren = true
    this.southern.eventMode = 'none'
    this.stage.addChild(this.world, this.southern)
    this.primarySpells = new PrimarySpellWorldView(this.world, textures, {
      postWorldQueueDepth: HUB_WORLD_DEPTH.courtyardForeground - 0.5,
    })
    this.levelUp = new NativeLevelUpWorldView(textures.levelUpSparkle)
    this.world.addChild(this.levelUp.container)
    this.secondaryAbilities = new NativeSecondaryWorldView(this.world, textures, renderer)
    this.world.addChild(this.worldLayer(hub.courtyard, HUB_WORLD_DEPTH.courtyard))
    this.sealGlyphs = this.worldLayer(hub.seals.glyphs, HUB_WORLD_DEPTH.sealGlyphs, HUB_WORLD_LAYER_BOUNDS.sealGlyphs)
    this.sealGlyphs.blendMode = 'add'
    this.sealCore = this.worldLayer(hub.seals.core, HUB_WORLD_DEPTH.sealCore, HUB_WORLD_LAYER_BOUNDS.sealCore)
    this.sealCore.blendMode = 'add'
    this.world.addChild(this.sealGlyphs, this.sealCore)
    this.usefulThyngsShadow = this.worldLayer(
      hub.tent.shadow,
      HUB_WORLD_DEPTH.usefulThyngsShadow,
      HUB_WORLD_LAYER_BOUNDS.usefulThyngsShadow,
    )
    this.world.addChild(this.usefulThyngsShadow)

    this.statueAura = new Sprite(textures.base[hub.props.statue.aura])
    this.statueAura.position.set(HUB_STATUE_ROOT.x - 24, HUB_STATUE_ROOT.y - 166)
    this.statueAura.zIndex = HUB_WORLD_DEPTH.statueAura
    this.statueAura.blendMode = 'multiply'
    this.statueAura.eventMode = 'none'
    this.statueBody = new Sprite(textures.base[hub.props.statue.body])
    this.statueBody.position.set(HUB_STATUE_ROOT.x - 76, HUB_STATUE_ROOT.y - 189)
    this.statueBody.zIndex = HUB_WORLD_DEPTH.statue
    this.statueBody.eventMode = 'none'
    this.world.addChild(this.statueAura, this.statueBody)

    this.addNpc(hub.npcs.annalist, 895.5, 455.5)

    this.hagatha = new HubHagathaView(textures, traderAnimationSeed ^ 5001, createdAtTick)
    this.luthacus = new HubCommonTraderView(
      textures,
      traderAnimationSeed ^ 5005,
      createdAtTick,
    )
    this.world.addChild(this.hagatha.container, this.luthacus.container)

    this.potion = new HubPotionTraderView(textures, createdAtTick)
    this.usefulThyngsStack.sortableChildren = true
    this.usefulThyngsStack.eventMode = 'none'
    this.usefulThyngsBack = this.worldLayer(
      hub.tent.back,
      HUB_USEFUL_THYNGS_CHILD_DEPTH.counter,
      HUB_WORLD_LAYER_BOUNDS.usefulThyngsBack,
    )
    this.usefulThyngsFront = this.worldLayer(
      hub.tent.front,
      HUB_USEFUL_THYNGS_CHILD_DEPTH.front,
      HUB_WORLD_LAYER_BOUNDS.usefulThyngsFront,
    )
    this.usefulThyngsStack.addChild(
      this.usefulThyngsBack,
      this.potion.actor,
      this.usefulThyngsFront,
      this.potion.balloons,
    )
    this.world.addChild(this.usefulThyngsStack)

    this.teacher = new HubTeacherView(textures, 576.5, 710.5, traderAnimationSeed ^ 5008)
    this.world.addChild(
      this.teacher.preWorld,
      this.teacher.container,
      this.teacher.worldColumn,
      this.teacher.worldFrames,
      this.teacher.postWorld,
    )

    this.skorcha = new HubSkorchaView(textures)
    this.world.addChild(this.skorcha.container)

    this.addNpcMarkers()
    this.walkToTalk = new HubWalkToTalkView(
      textures.fontAtlas,
      textures.base[hub.markers.onboarding.walkToTalkArrow],
    )
    this.walkToTalk.container.zIndex = HUB_WORLD_DEPTH.courtyardOnboarding
    this.world.addChild(this.walkToTalk.container)

    this.astronomer = new HubAstronomerView(textures, createdAtTick)

    this.addCourtyardObstacles()
    this.world.addChild(this.worldLayer(
      hub.foreground.courtyard,
      HUB_WORLD_DEPTH.courtyardForeground,
      HUB_WORLD_LAYER_BOUNDS.courtyardForeground,
    ))
    this.addSouthernArchitecture()
    this.southern.addChild(
      this.astronomer.behind,
      this.astronomer.telescope,
      this.astronomer.front,
    )
  }

  update(
    snapshot: HubPresentationFrame,
    localPlayerId: string,
    presentationFrame?: number,
    levelUpPresentation: {
      elapsedMs: number
      playerScreenY: number
      presentationId: number
    } | null = null,
    pointGainAt: (position: Readonly<{ x: number, y: number }>) => number = () => 1,
    markerSurface: HubNpcMarkerSurface = null,
  ): void {
    const ambient = snapshot.world.ambient
    const colors = hubSealColors(ambient)
    this.sealGlyphs.tint = colorTint(colors.glyphs)
    this.sealGlyphs.alpha = colors.glyphs.alpha
    this.sealCore.tint = colorTint(colors.core)
    this.sealCore.alpha = colors.core.alpha
    this.updateNpcMarkers(snapshot, localPlayerId, markerSurface)
    this.updateFountain(snapshot)
    const statue = hubStatueOffsets(ambient)
    this.statueAura.position.set(
      HUB_STATUE_ROOT.x - 24 + statue.aura.x,
      HUB_STATUE_ROOT.y - 166 + statue.aura.y,
    )
    this.statueBody.position.set(
      HUB_STATUE_ROOT.x - 76 + statue.body.x,
      HUB_STATUE_ROOT.y - 189 + statue.body.y,
    )
    this.potion.update(snapshot.tick)
    this.hagatha.update(snapshot.tick)
    this.luthacus.update(snapshot.tick)
    this.teacher.update(snapshot.world.ambient.teacherTick / 100)
    this.skorcha.update(snapshot.world.skorcha)
    this.astronomer.update(snapshot.tick)
    this.updateStudents(snapshot)
    this.updatePlayers(snapshot)
    this.primarySpells.update(
      snapshot.primarySpells,
      'hub:courtyard',
      presentationFrame,
      pointGainAt,
    )
    this.secondaryAbilities.update(
      snapshot.secondaryAbilities,
      'hub:courtyard',
      presentationFrame,
      pointGainAt,
    )
    this.applyPainterOrder(snapshot, localPlayerId)
    this.primarySpells.promoteOwnerOverlays((ownerId) => (
      this.players.get(ownerId)?.container.zIndex
    ))
    const player = snapshot.players[localPlayerId]
    const playerView = this.players.get(localPlayerId)
    const levelUpFrame = levelUpPresentation === null
      ? null
      : nativeLevelUpPresentationFrame(
          levelUpPresentation.presentationId,
          levelUpPresentation.elapsedMs,
          levelUpPresentation.playerScreenY,
        )
    this.levelUp.update(
      levelUpFrame,
      player?.position ?? { x: 0, y: 0 },
      (playerView?.container.zIndex ?? 1) + 0.1,
    )
  }

  player(playerId: string): PlayerWorldView | undefined {
    return this.players.get(playerId)
  }

  get studentCount(): number {
    return this.students.size
  }

  get collegeObstacleCount(): number {
    return this.courtyardObstacles.length
  }

  get markerZIndexes(): Readonly<Record<string, number>> {
    return Object.fromEntries(
      [...this.markerSprites].map(([interactionId, marker]) => [interactionId, marker.zIndex]),
    )
  }

  get usefulThyngsChildDepths(): readonly number[] {
    return [
      this.usefulThyngsBack.zIndex,
      this.potion.actor.zIndex,
      this.usefulThyngsFront.zIndex,
      this.potion.balloons.zIndex,
    ]
  }

  get usefulThyngsMarkerZIndex(): number {
    return this.markerSprites.get('fomentius')?.zIndex ?? Number.NaN
  }

  get usefulThyngsShadowZIndex(): number {
    return this.usefulThyngsShadow.zIndex
  }

  get usefulThyngsStackZIndex(): number {
    return this.usefulThyngsStack.zIndex
  }

  get pooledStudentViewCount(): number {
    return this.retiredStudentViews.length
  }

  get studentViewCreationCount(): number {
    return this.createdStudentViewCount
  }

  get studentViewReuseCount(): number {
    return this.reusedStudentViewCount
  }

  get teacherFrame(): number {
    return this.teacher.frame
  }

  get teacherBurst(): HubTeacherBurstPresentation {
    return this.teacher.burstPresentation
  }

  get astronomerTelescopeFrame(): number {
    return this.astronomer.telescopeFrame
  }

  get astronomerRenderable(): boolean {
    return this.astronomer.renderable
      && this.astronomer.behind.parent === this.southern
      && this.astronomer.telescope.parent === this.southern
      && this.astronomer.front.parent === this.southern
  }

  get southernArchitectureCount(): number {
    return this.southernArchitecture.length
  }

  get southernChildCount(): number {
    return this.southern.children.length
  }

  get southernArtRenderable(): boolean {
    return this.southern.visible
      && this.southern.renderable
      && this.southern.parent === this.stage
      && this.southernArchitecture.every((sprite) => (
        sprite.visible && sprite.renderable && sprite.parent === this.southern
      ))
      && this.astronomerRenderable
  }

  get cameraRenderGroupCount(): number {
    return Number(this.world.isRenderGroup) + Number(this.southern.isRenderGroup)
  }

  get primarySpellCount(): number {
    return this.primarySpells.count
  }

  get primarySpellKinds(): readonly string[] {
    return this.primarySpells.kinds
  }

  get levelUpParticleCount(): number {
    return this.levelUp.particleCount
  }

  get secondaryAbilityCount(): number {
    return this.secondaryAbilities.count
  }

  get secondaryAbilityKinds(): readonly string[] {
    return this.secondaryAbilities.kinds
  }

  get secondaryAbilityPrimitiveCount(): number {
    return this.secondaryAbilities.primitiveCount
  }

  get secondaryAbilitySamples() {
    return this.secondaryAbilities.diagnosticSamples
  }

  get painterOrder() {
    return this.lastPainterOrder
  }

  get visibleMarkerIds(): readonly NativeHubInteractionId[] {
    return [...this.markerSprites]
      .filter(([, marker]) => marker.visible)
      .map(([interactionId]) => interactionId)
  }

  destroy(): void {
    this.painterPlanner.clear()
    this.world.removeChild(this.walkToTalk.container)
    this.walkToTalk.destroy()
    this.world.removeChild(this.levelUp.container)
    this.levelUp.destroy()
    this.primarySpells.destroy()
    this.secondaryAbilities.destroy()
    for (const view of this.retiredStudentViews) view.destroy()
    this.retiredStudentViews.length = 0
    this.players.clear()
    this.playerElements.clear()
    this.livePlayerIds.clear()
    this.students.clear()
    this.liveStudentIds.clear()
    this.fountain.clear()
    this.liveFountainIds.clear()
    this.stage.destroy({ children: true })
  }

  private addNpc(source: string, x: number, y: number): void {
    const actor = new Container({ label: 'courtyard-npc' })
    actor.sortableChildren = true
    actor.position.set(x, y)
    actor.zIndex = hubWorldDepthForActor(y)
    actor.eventMode = 'none'
    const shadow = actorSprite(this.textures.base[hub.npcs.teacher.shadow], 0)
    shadow.scale.set(1.25)
    shadow.alpha = 0.62
    const body = new Sprite(this.textures.base[source])
    body.anchor.set(0.5, 1)
    body.position.y = 4
    body.zIndex = 1
    body.eventMode = 'none'
    actor.addChild(shadow, body)
    this.nonPlayerActors.push(actor)
    this.world.addChild(actor)
  }

  private addNpcMarkers(): void {
    for (const actor of NATIVE_HUB_NPC_CATALOG.markers.actors) {
      if (actor.region !== 'courtyard') continue
      const marker = new Sprite(this.textures.base[courtyardMarkerSource(
        actor.style,
        actor.side,
      )])
      marker.anchor.set(0.5)
      marker.eventMode = 'none'
      this.markerSprites.set(actor.interactionId, marker)
      this.world.addChild(marker)
    }
  }

  private updateNpcMarkers(
    snapshot: HubPresentationFrame,
    localPlayerId: string,
    markerSurface: HubNpcMarkerSurface,
  ): void {
    const participant = snapshot.world.participants[localPlayerId]
    const player = snapshot.players[localPlayerId]
    const region = participant?.region ?? null
    if (region === 'courtyard' && this.lastLocalRegion !== 'courtyard' && player) {
      this.markerSuppression = captureHubNpcMarkerSuppression(player.economy.npc.helpFlags)
      this.markerSuppressionInitialized = true
      this.markerEpochSeed = snapshot.world.traderAnimationSeed ^ snapshot.tick
      this.markerEpochStartedAtTick = snapshot.tick
    }
    this.lastLocalRegion = region
    if (!this.markerSuppressionInitialized && player) {
      this.markerSuppression = captureHubNpcMarkerSuppression(player.economy.npc.helpFlags)
      this.markerSuppressionInitialized = true
    }
    for (const [interactionId, marker] of this.markerSprites) {
      const frame = hubNpcMarkerFrame(
        interactionId,
        Math.max(0, snapshot.tick - this.markerEpochStartedAtTick),
        this.markerEpochSeed,
        this.markerSuppression,
        {
          skorchaPosition: snapshot.world.skorcha?.position ?? null,
          skorchaVariant: snapshot.world.skorcha?.variant ?? null,
          surface: markerSurface,
        },
      )
      marker.visible = frame.visible
      marker.alpha = frame.alpha
      marker.position.copyFrom(frame.position)
      marker.texture = this.textures.base[courtyardMarkerSource(frame.style, frame.side)]
    }
    this.walkToTalk.container.visible = Boolean(
      player
      && region === 'courtyard'
      && hubNpcOnboardingPlan(player.economy.npc.helpFlags, snapshot.tick, markerSurface)
        .some(plan => plan.kind === 'walk-to-talk'),
    )
  }

  private addCourtyardObstacles(): void {
    for (let index = 0; index < HUB_COURTYARD_OBSTACLES.length; index += 1) {
      const obstacle = HUB_COURTYARD_OBSTACLES[index]
      const texture = this.textures.visualAtlas.frame(
        hub.obstacles,
        index,
        0,
      )
      const sprite = new Sprite(texture)
      sprite.zIndex = hubWorldDepthForActor(obstacle.position.y)
      sprite.eventMode = 'none'
      this.world.addChild(sprite)
      this.courtyardObstacles.push({ obstacle, sprite })
    }
  }

  private applyPainterOrder(
    snapshot: HubPresentationFrame,
    localPlayerId: string,
  ): void {
    const referenceY = snapshot.players[localPlayerId]?.position.y ?? 0
    const layers: NativeHubPainterLayer[] = []
    const fixed = (
      id: Parameters<typeof nativeHubFixedActorPainterRegistration>[0],
      target: Container,
      worldY: number,
    ) => {
      if (!target.visible) return
      layers.push({
        id: `fixed:${id}`,
        registration: nativeHubFixedActorPainterRegistration(id),
        sortBias: id === 'fomentius' ? -5 : 0,
        target,
        worldY,
      })
    }
    const annalist = this.nonPlayerActors[0]
    if (annalist) fixed('annalist', annalist, annalist.position.y)
    fixed('hagatha', this.hagatha.container, this.hagatha.container.position.y)
    fixed('luthacus', this.luthacus.container, this.luthacus.container.position.y)
    fixed('fomentius', this.usefulThyngsStack, this.potion.actor.position.y)
    fixed('teacher', this.teacher.container, this.teacher.container.position.y)
    fixed('skorcha', this.skorcha.container, this.skorcha.container.position.y)

    for (const { obstacle, sprite } of this.courtyardObstacles) {
      layers.push({
        id: `fixed:${obstacle.id}`,
        registration: nativeHubFixedActorPainterRegistration(obstacle.id),
        sortBias: obstacle.sortBias,
        target: sprite,
        worldY: obstacle.position.y,
      })
    }
    layers.push({
      id: `fixed:${NATIVE_HUB_COLLEGE_STATUE.id}`,
      registration: nativeHubFixedActorPainterRegistration(NATIVE_HUB_COLLEGE_STATUE.id),
      sortBias: NATIVE_HUB_COLLEGE_STATUE.sortBias,
      target: this.statueBody,
      worldY: NATIVE_HUB_COLLEGE_STATUE.position.y,
    })
    for (const [playerId, view] of this.players) {
      const player = snapshot.players[playerId]
      if (!player) continue
      layers.push({
        id: `player:${playerId}`,
        registration: player.lighting.lightRegistration,
        sortBias: nativeCourtyardPlayerSortBias(player.position, player.headingIndex),
        target: view.container,
        worldY: player.position.y,
      })
    }
    const studentById = new Map(snapshot.world.students.map((student) => [
      student.id,
      student,
    ]))
    for (const [studentId, view] of this.students) {
      const student = studentById.get(studentId)
      if (!student) continue
      layers.push({
        id: `student:${studentId}`,
        registration: student.painterRegistration,
        sortBias: 0,
        target: view.container,
        worldY: student.position.y,
      })
    }
    const teacherRelease = snapshot.world.ambient.teacherWorldRelease
    if (teacherRelease) {
      if (this.teacher.worldColumn.visible) {
        layers.push({
          id: `teacher-column:${teacherRelease.releaseIndex}`,
          registration: teacherRelease.painterRegistrations[0]!,
          sortBias: 0,
          target: this.teacher.worldColumn,
          worldY: this.teacher.releaseY,
        })
      }
      if (this.teacher.worldFrames.visible) {
        layers.push({
          id: `teacher-frames:${teacherRelease.releaseIndex}`,
          registration: teacherRelease.painterRegistrations[1]!,
          sortBias: 0,
          target: this.teacher.worldFrames,
          worldY: this.teacher.releaseY,
        })
      }
    }
    for (const layer of this.primarySpells.painterLayers()) {
      if (layer.lane !== 'world-sorted') continue
      const insertionTargets = Object.fromEntries((layer.insertions ?? []).map((insertion) => [
        insertion.id,
        depthTarget((depth) => this.primarySpells.setDepth(insertion.id, depth)),
      ]))
      layers.push({
        id: layer.id,
        insertionTargets,
        insertions: layer.insertions,
        registration: layer.registration,
        sortBias: layer.sortBias,
        target: depthTarget((depth) => this.primarySpells.setDepth(layer.id, depth)),
        visible: layer.visible,
        worldY: layer.worldY,
      })
    }
    for (const layer of this.secondaryAbilities.painterLayers()) {
      if (layer.lane !== 'world-sorted' || layer.registration === null) continue
      const insertionTargets = Object.fromEntries((layer.insertions ?? []).map((insertion) => [
        insertion.id,
        depthTarget((depth) => this.secondaryAbilities.setDepth(insertion.id, depth)),
      ]))
      layers.push({
        id: layer.id,
        insertionTargets,
        insertions: layer.insertions,
        registration: layer.registration,
        sortBias: layer.sortBias,
        target: depthTarget((depth) => this.secondaryAbilities.setDepth(layer.id, depth)),
        visible: layer.visible,
        worldY: layer.worldY,
      })
    }
    this.lastPainterOrder = this.painterPlanner.apply(layers, referenceY)
    this.statueAura.zIndex = this.statueBody.zIndex - 0.25
    for (const [interactionId, target] of [
      ['hagatha', this.hagatha.container],
      ['annalist', annalist],
      ['fomentius', this.usefulThyngsStack],
      ['luthacus', this.luthacus.container],
      ['skorcha', this.skorcha.container],
      ['teacher', this.teacher.container],
    ] as const) {
      const marker = this.markerSprites.get(interactionId)
      if (marker && target) {
        marker.zIndex = target.zIndex + HUB_NPC_MARKER_TAIL_OFFSET
      }
    }
  }

  private worldLayer(
    source: string,
    zIndex: number,
    bounds?: { x: number; y: number; width: number; height: number },
  ): Sprite {
    const texture = bounds
      ? this.textures.visualAtlas.subframe(
          source,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
        )
      : this.textures.base[source]
    const sprite = new Sprite(texture)
    sprite.position.set(bounds?.x ?? 0, bounds?.y ?? 0)
    sprite.zIndex = zIndex
    sprite.eventMode = 'none'
    return sprite
  }

  private addSouthernArchitecture(): void {
    let x = 90
    let slot = 0
    let previousWasTower = false
    while (x < HUB_SOUTHERN_EXTENT.x) {
      if (slot === 4 || slot === 6) {
        this.southern.addChild(this.southernSprite(
          hub.southern.tower,
          x,
          HUB_SOUTHERN_EXTENT.y - 186,
        ))
        x += 179
        previousWasTower = true
      } else {
        const y = HUB_SOUTHERN_EXTENT.y - 126 + (slot === 5 ? 0 : 30)
        this.southern.addChild(this.southernSprite(hub.southern.battlement, x, y))
        if (previousWasTower) {
          this.southern.addChild(this.southernSprite(hub.southern.seam, x - 1, y))
        }
        x += 209
        previousWasTower = false
      }
      slot += 1
    }
    this.southern.addChild(
      this.southernSprite(
        hub.southern.platformWest,
        HUB_SOUTHERN_WEST_PLATFORM_ORIGIN.x,
        HUB_SOUTHERN_WEST_PLATFORM_ORIGIN.y,
      ),
      this.southernSprite(
        hub.southern.platformEast,
        HUB_SOUTHERN_EAST_PLATFORM_ORIGIN.x,
        HUB_SOUTHERN_EAST_PLATFORM_ORIGIN.y,
      ),
    )
  }

  private southernSprite(source: string, x: number, y: number): Sprite {
    const sprite = new Sprite(this.textures.base[source])
    sprite.position.set(x, y)
    sprite.zIndex = HUB_WORLD_DEPTH.southernForeground
    sprite.eventMode = 'none'
    this.southernArchitecture.push(sprite)
    return sprite
  }

  countVisibleStudents(
    snapshot: HubPresentationFrame,
    camera: { x: number; y: number },
    view: { height: number; width: number },
  ): number {
    let visible = 0
    for (const student of snapshot.world.students) {
      visible += Number(hubStudentIntersectsView(student, camera, view))
    }
    return visible
  }

  private updateFountain(snapshot: HubPresentationFrame): void {
    const live = this.liveFountainIds
    live.clear()
    for (const particle of snapshot.world.ambient.fountainParticles) {
      live.add(particle.id)
      let sprite = this.fountain.get(particle.id)
      if (!sprite) {
        sprite = new Sprite(this.textures.base[hub.fountainParticle])
        sprite.anchor.set(0.5)
        sprite.blendMode = 'add'
        sprite.position.set(HUB_FOUNTAIN_ORIGIN.x, HUB_FOUNTAIN_ORIGIN.y)
        sprite.zIndex = HUB_WORLD_DEPTH.fountain
        sprite.eventMode = 'none'
        this.fountain.set(particle.id, sprite)
        this.world.addChild(sprite)
      }
      sprite.alpha = hubFountainParticleAlpha(particle)
      sprite.scale.set(particle.scale)
    }
    for (const [id, sprite] of this.fountain) {
      if (live.has(id)) continue
      this.fountain.delete(id)
      sprite.destroy()
    }
  }

  private updatePlayers(snapshot: HubPresentationFrame): void {
    const live = this.livePlayerIds
    live.clear()
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      const participant = snapshot.world.participants[playerId]
      if (participant?.region !== 'courtyard') continue
      live.add(playerId)
      let view = this.players.get(playerId)
      if (view && this.playerElements.get(playerId) !== player.config.element) {
        this.players.delete(playerId)
        this.playerElements.delete(playerId)
        view.destroy()
        view = undefined
      }
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures, this.modTextures, this.renderer, false)
        this.players.set(playerId, view)
        this.playerElements.set(playerId, player.config.element)
        this.world.addChild(view.container)
      }
      view.setSecondaryState(snapshot.secondaryAbilities.players[playerId], snapshot.tick)
      view.update(
        player,
        snapshot.tick,
        playerStaffActionPose(
          snapshot.primarySpells.transients,
          playerId,
          'hub:courtyard',
        ),
        participant.collegeIntro === null,
        participant.transition !== null || participant.collegeIntro !== null,
      )
    }
    for (const [playerId, view] of this.players) {
      if (live.has(playerId)) continue
      this.players.delete(playerId)
      this.playerElements.delete(playerId)
      view.destroy()
    }
  }

  private updateStudents(snapshot: HubPresentationFrame): void {
    const live = this.liveStudentIds
    live.clear()
    for (const student of snapshot.world.students) {
      live.add(student.id)
      let view = this.students.get(student.id)
      if (!view) {
        view = this.retiredStudentViews.pop()
        if (view) this.reusedStudentViewCount += 1
        else {
          view = new HubStudentView(this.textures)
          this.createdStudentViewCount += 1
        }
        this.students.set(student.id, view)
        this.world.addChild(view.container)
      }
      view.update(student)
    }
    for (const [id, view] of this.students) {
      if (live.has(id)) continue
      this.students.delete(id)
      this.world.removeChild(view.container)
      view.prepareForPool()
      if (this.retiredStudentViews.length < 256) this.retiredStudentViews.push(view)
      else view.destroy()
    }
  }
}

class HubAstronomerView {
  readonly behind = new Container({ label: 'astronomer-behind-telescope' })
  readonly telescope: Sprite
  readonly front = new Container({ label: 'astronomer-before-telescope' })
  private readonly redShadow: Sprite
  private readonly red: Sprite
  private readonly greenShadow: Sprite
  private readonly green: Sprite
  private readonly grayShadow: Sprite
  private readonly gray: Sprite
  private readonly blueShadow: Sprite
  private readonly blue: Sprite
  private readonly purpleShadow: Sprite
  private readonly purple: Sprite
  private readonly brownShadow: Sprite
  private readonly brown: Sprite
  private readonly clock: ReturnType<typeof createHubAstronomerClock>
  private readonly textures: HubWorldTextures
  private currentTelescopeFrame = 0

  constructor(textures: HubWorldTextures, createdAtTick: number) {
    this.textures = textures
    this.clock = createHubAstronomerClock(createdAtTick)
    this.behind.sortableChildren = true
    this.behind.position.set(HUB_ASTRONOMER_ROOT.x, HUB_ASTRONOMER_ROOT.y)
    this.behind.zIndex = HUB_WORLD_DEPTH.astronomer
    this.behind.eventMode = 'none'
    this.front.zIndex = HUB_WORLD_DEPTH.astronomerFront
    this.front.position.set(HUB_ASTRONOMER_ROOT.x, HUB_ASTRONOMER_ROOT.y)
    this.front.eventMode = 'none'

    const shadow = textures.base[hub.npcs.teacher.shadow]
    this.redShadow = actorSprite(shadow, 0)
    this.red = actorSprite(textures.astronomer.red.idle[0], 1)
    this.greenShadow = actorSprite(shadow, 2)
    this.green = actorSprite(textures.astronomer.green.idle[0], 3)
    this.grayShadow = actorSprite(shadow, 4)
    this.gray = actorSprite(textures.astronomer.assistants.gray[0], 5)
    this.blueShadow = actorSprite(shadow, 6)
    this.blue = actorSprite(textures.astronomer.assistants.blue[0], 7)
    this.brownShadow = actorSprite(shadow, 8)
    this.purpleShadow = actorSprite(shadow, 9)
    this.purple = actorSprite(textures.astronomer.assistants.purple[0], 10)
    this.behind.addChild(
      this.redShadow,
      this.red,
      this.greenShadow,
      this.green,
      this.grayShadow,
      this.gray,
      this.blueShadow,
      this.blue,
      this.brownShadow,
      this.purpleShadow,
      this.purple,
    )

    this.telescope = new Sprite(textures.astronomer.telescope[0])
    this.telescope.position.set(
      HUB_ASTRONOMER_TELESCOPE_ORIGIN.x,
      HUB_ASTRONOMER_TELESCOPE_ORIGIN.y,
    )
    this.telescope.zIndex = HUB_WORLD_DEPTH.astronomerTelescope
    this.telescope.eventMode = 'none'

    this.brown = actorSprite(textures.astronomer.assistants.brown[0], 1)
    this.front.addChild(this.brown)
  }

  update(tick: number): void {
    const frame = this.clock.advanceTo(tick)
    this.redShadow.zIndex = frame.active ? 2 : 0
    this.red.zIndex = frame.active ? 3 : 1
    this.greenShadow.zIndex = frame.active ? 0 : 2
    this.green.zIndex = frame.active ? 1 : 3
    this.currentTelescopeFrame = frame.telescopeFrame
    this.telescope.texture = this.textures.astronomer.telescope[frame.telescopeFrame]
    this.updateMain(this.red, this.redShadow, frame.red, this.textures.astronomer.red)
    this.updateMain(this.green, this.greenShadow, frame.green, this.textures.astronomer.green)
    this.updateAssistant(
      this.gray,
      this.grayShadow,
      frame.assistants.gray,
      this.textures.astronomer.assistants.gray,
    )
    this.updateAssistant(
      this.blue,
      this.blueShadow,
      frame.assistants.blue,
      this.textures.astronomer.assistants.blue,
    )
    this.updateAssistant(
      this.purple,
      this.purpleShadow,
      frame.assistants.purple,
      this.textures.astronomer.assistants.purple,
    )
    this.brown.texture = this.textures.astronomer.assistants.brown[frame.assistants.brown.frame]
    this.brown.position.copyFrom(frame.assistants.brown.position)
    placeAstronomerShadow(this.brownShadow, frame.assistants.brown.shadowPosition)
  }

  get telescopeFrame(): number {
    return this.currentTelescopeFrame
  }

  get renderable(): boolean {
    return this.behind.visible
      && this.behind.renderable
      && this.behind.children.every((child) => child.visible && child.renderable)
      && this.telescope.visible
      && this.telescope.renderable
      && this.front.visible
      && this.front.renderable
      && this.front.children.every((child) => child.visible && child.renderable)
  }

  private updateMain(
    actor: Sprite,
    shadow: Sprite,
    frame: HubAstronomerMainActorFrame,
    textures: HubWorldTextures['astronomer']['red'],
  ): void {
    actor.texture = textures[frame.bank][frame.frame]
    actor.position.copyFrom(frame.position)
    placeAstronomerShadow(shadow, frame.shadowPosition)
  }

  private updateAssistant(
    actor: Sprite,
    shadow: Sprite,
    frame: HubAstronomerAssistantFrame,
    textures: readonly Texture[],
  ): void {
    actor.texture = textures[frame.frame]
    actor.position.copyFrom(frame.position)
    placeAstronomerShadow(shadow, frame.shadowPosition)
  }
}

class HubHagathaView {
  readonly container = new Container({ label: 'perk-witch' })
  private readonly body: Sprite
  private readonly clock: HubHagathaClock
  private readonly liveParticleIds = new Set<number>()
  private readonly particles = new Map<number, Sprite>()
  private readonly textures: HubWorldTextures

  constructor(textures: HubWorldTextures, seed: number, createdAtTick: number) {
    this.textures = textures
    this.clock = createHubHagathaClock(seed, createdAtTick)
    this.container.sortableChildren = true
    this.container.position.set(1340, 280)
    this.container.zIndex = hubWorldDepthForActor(280)
    this.container.eventMode = 'none'

    const shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 0)
    shadow.scale.set(1.25)
    shadow.alpha = 0.62
    this.body = new Sprite(textures.traders.hagatha.body[0])
    this.body.anchor.set(0.5)
    this.body.position.set(-5, 0)
    this.body.zIndex = 1
    this.body.eventMode = 'none'
    const accessory = new Sprite(textures.base[hub.npcs.perkWitchAccessory])
    accessory.anchor.set(0.5)
    accessory.position.set(-25, 15)
    accessory.zIndex = 2
    accessory.eventMode = 'none'
    this.container.addChild(shadow, this.body, accessory)
  }

  update(tick: number): void {
    const frame = this.clock.advanceTo(tick)
    this.body.texture = this.textures.traders.hagatha.body[frame.bodyFrame]
    const live = this.liveParticleIds
    live.clear()
    for (const particle of frame.particles) {
      live.add(particle.id)
      let sprite = this.particles.get(particle.id)
      if (!sprite) {
        sprite = this.createParticle(particle)
        this.particles.set(particle.id, sprite)
        this.container.addChild(sprite)
      }
      sprite.texture = this.textures.traders.hagatha.crossfades[particle.frame]
      sprite.position.copyFrom(particle.offset)
      sprite.scale.set(particle.scale)
      sprite.alpha = particle.alpha
    }
    for (const [id, sprite] of this.particles) {
      if (live.has(id)) continue
      this.particles.delete(id)
      sprite.destroy()
    }
  }

  private createParticle(particle: HubHagathaParticle): Sprite {
    const sprite = new Sprite(this.textures.traders.hagatha.crossfades[particle.frame])
    sprite.zIndex = 3
    sprite.eventMode = 'none'
    return sprite
  }
}

class HubCommonTraderView {
  readonly container = new Container({ label: 'items-trader' })
  private readonly clock: HubCommonTraderClock
  private readonly sprite: Sprite
  private readonly textures: HubWorldTextures

  constructor(textures: HubWorldTextures, seed: number, createdAtTick: number) {
    this.textures = textures
    this.clock = createHubCommonTraderClock(seed, createdAtTick)
    this.container.sortableChildren = true
    this.container.position.set(1700.5, 449.5)
    this.container.zIndex = hubWorldDepthForActor(449.5)
    this.container.eventMode = 'none'
    const shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 0)
    shadow.scale.set(1.25)
    shadow.alpha = 0.62
    this.sprite = new Sprite(textures.traders.luthacus[0])
    this.sprite.anchor.set(0.5)
    this.sprite.zIndex = 1
    this.sprite.eventMode = 'none'
    this.container.addChild(shadow, this.sprite)
  }

  update(tick: number): void {
    this.sprite.texture = this.textures.traders.luthacus[this.clock.advanceTo(tick)]
  }
}

class HubSkorchaView {
  readonly container = new Container({ label: 'skorcha' })
  private readonly body: Sprite
  private readonly hat: Sprite
  private readonly textures: HubWorldTextures

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.container.visible = false
    const shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 0)
    shadow.scale.set(1.25)
    shadow.alpha = 0.62
    this.body = actorSprite(textures.skorcha[0], 1)
    this.hat = actorSprite(textures.skorcha[3], 2)
    this.container.addChild(shadow, this.body, this.hat)
  }

  update(state: ProtocolHubSkorchaState | null): void {
    this.container.visible = state !== null
    if (state === null) return
    this.container.position.copyFrom(state.position)
    this.container.zIndex = hubWorldDepthForActor(state.position.y)
    this.container.scale.x = state.variant === 1 ? -1 : 1
    this.body.texture = this.textures.skorcha[state.gesture]
    this.hat.visible = state.hatFrame < 4
    if (state.hatFrame < 4) this.hat.texture = this.textures.skorcha[3 + state.hatFrame]
  }
}

class HubPotionTraderView {
  readonly actor = new Container({ label: 'potion-trader' })
  readonly balloons: Sprite
  private readonly clock: ReturnType<typeof createHubPotionTraderClock>
  private readonly sprite: Sprite
  private readonly textures: HubWorldTextures

  constructor(textures: HubWorldTextures, createdAtTick: number) {
    this.textures = textures
    this.clock = createHubPotionTraderClock(createdAtTick)
    this.actor.position.set(1397, 664)
    this.actor.zIndex = HUB_USEFUL_THYNGS_CHILD_DEPTH.trader
    this.actor.eventMode = 'none'
    this.sprite = new Sprite(textures.potion.actor[0])
    this.sprite.position.set(-12, -46)
    this.sprite.eventMode = 'none'
    this.actor.addChild(this.sprite)

    this.balloons = new Sprite(textures.potion.balloons[0])
    this.balloons.position.set(1320, 516)
    this.balloons.zIndex = HUB_USEFUL_THYNGS_CHILD_DEPTH.balloons
    this.balloons.eventMode = 'none'

  }

  update(tick: number): void {
    const frame = this.clock.advanceTo(tick)
    this.sprite.texture = this.textures.potion.actor[frame.actorFrame]
    this.balloons.texture = this.textures.potion.balloons[frame.balloonFrame]
    this.balloons.position.y = 516 + frame.balloonOffsetY
  }
}

class HubTeacherView {
  readonly container = new Container({ label: 'teacher' })
  readonly postWorld = new Container({ label: 'teacher-release-post-world' })
  readonly preWorld = new Container({ label: 'teacher-release-pre-world' })
  readonly worldColumn = new Container({ label: 'teacher-release-column' })
  readonly worldFrames = new Container({ label: 'teacher-release-frames' })
  readonly releaseY: number
  private readonly rune: Sprite
  private readonly actor: Sprite
  private readonly column: Sprite
  private readonly flare: Sprite
  private readonly core: Sprite
  private readonly frames: Sprite
  private readonly textures: HubWorldTextures
  private readonly seed: number
  private currentBurst: HubTeacherBurstPresentation
  private currentFrame = 0

  constructor(textures: HubWorldTextures, x: number, y: number, seed: number) {
    this.textures = textures
    this.seed = seed
    this.currentBurst = hubTeacherBurstAt(0, seed)
    this.container.sortableChildren = true
    this.container.position.set(x, y)
    this.container.zIndex = hubWorldDepthForActor(y)
    this.container.eventMode = 'none'
    const releaseX = x + HUB_TEACHER_CAST_ORIGIN.x
    const releaseY = y + HUB_TEACHER_CAST_ORIGIN.y
    this.releaseY = releaseY
    this.preWorld.position.set(releaseX, releaseY)
    this.preWorld.zIndex = HUB_WORLD_DEPTH.teacherPreWorld
    this.preWorld.eventMode = 'none'
    this.worldColumn.position.set(releaseX, releaseY)
    this.worldColumn.eventMode = 'none'
    this.worldFrames.position.set(releaseX, releaseY)
    this.worldFrames.eventMode = 'none'
    this.postWorld.position.set(releaseX, releaseY)
    this.postWorld.zIndex = HUB_WORLD_DEPTH.teacherPostWorld
    this.postWorld.eventMode = 'none'
    this.rune = actorSprite(textures.base[hub.npcs.teacher.rune], 0)
    this.rune.position.set(HUB_TEACHER_RUNE_CENTER.x, HUB_TEACHER_RUNE_CENTER.y)
    this.rune.alpha = HUB_TEACHER_RUNE_ALPHA
    const shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 1)
    shadow.scale.set(1.25)
    this.actor = actorSprite(textures.teacher.actor[0], 2)
    this.column = centered(textures.base[hub.npcs.teacher.burst.column])
    this.flare = centered(textures.base[hub.npcs.teacher.burst.flare])
    this.core = centered(textures.base[hub.npcs.teacher.burst.core])
    this.frames = centered(textures.teacher.burst[0])
    this.frames.blendMode = 'add'
    this.preWorld.addChild(this.flare)
    this.worldColumn.addChild(this.column)
    this.worldFrames.addChild(this.frames)
    this.postWorld.addChild(this.core)
    this.container.addChild(this.rune, shadow, this.actor)
  }

  update(elapsedSeconds: number): void {
    this.currentFrame = hubTeacherFrameAt(elapsedSeconds, this.seed)
    this.actor.texture = this.textures.teacher.actor[this.currentFrame]
    const burst = hubTeacherBurstAt(elapsedSeconds, this.seed)
    this.currentBurst = burst
    this.preWorld.visible = burst.flare.visible
    this.worldColumn.visible = burst.column.visible
    this.worldFrames.visible = burst.frames.visible
    this.postWorld.visible = burst.core.visible
    if (!burst.visible) return
    this.column.visible = burst.column.visible
    this.column.alpha = burst.column.alpha
    this.column.scale.set(burst.column.scaleX, burst.column.scaleY)
    this.flare.visible = burst.flare.visible
    this.flare.alpha = burst.flare.alpha
    this.flare.scale.set(burst.flare.scaleX, burst.flare.scaleY)
    this.core.visible = burst.core.visible
    this.core.alpha = burst.core.alpha
    this.core.scale.set(burst.core.scaleX, burst.core.scaleY)
    this.frames.visible = burst.frames.visible
    this.frames.texture = this.textures.teacher.burst[spriteFrameIndex(burst.frames.frame, 11)]
    this.frames.alpha = burst.frames.alpha
    this.frames.scale.set(burst.frames.scaleX, burst.frames.scaleY)
  }

  get frame(): number {
    return this.currentFrame
  }

  get burstPresentation(): HubTeacherBurstPresentation {
    return this.currentBurst
  }
}

function centered(texture: Texture): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.eventMode = 'none'
  return sprite
}

function placeAstronomerShadow(shadow: Sprite, position: { x: number; y: number }): void {
  shadow.position.copyFrom(position)
}

function colorTint(color: HubColor): number {
  const red = Math.round(color.red * 255)
  const green = Math.round(color.green * 255)
  const blue = Math.round(color.blue * 255)
  return (red << 16) | (green << 8) | blue
}

function depthTarget(setDepth: (depth: number) => void): { zIndex: number } {
  return {
    get zIndex() {
      return 0
    },
    set zIndex(depth: number) {
      setDepth(depth)
    },
  }
}
