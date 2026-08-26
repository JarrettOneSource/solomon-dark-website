import { Container, Sprite, Texture, type Renderer } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import {
  HUB_PRIVATE_ROOM_LAYOUTS,
  type HubPrivateRoomAsset,
  type HubPrivateRoomLayoutDefinition,
  type PrivateHubRegionId,
} from '../core-kernels/hub-private-room-layout.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import { playerStaffActionPose } from '../player-character-presentation.ts'
import {
  createHubCommonTraderClock,
  createHubPolisherClock,
  type HubCommonTraderClock,
  type HubPolisherClock,
} from '../hub-presentation.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
  type NativeHubInteractionId,
} from '../core-kernels/native-hub-npc.ts'
import { HubPlayerView } from './hub-actors.ts'
import {
  HUB_LIBRARY_EXIT_MASKS,
  HUB_PRIVATE_ROOM_EFFECT_DEPTH,
  HUB_PRIVATE_ROOM_FLAME_ANCHORS,
  HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
  HUB_MORTUARY_MEMORIAL_GLOW,
  hubMemoratorHeadingIndex,
  hubRoomFlameTransform,
} from './hub-private-room-presentation.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import { HubMemorialPaintingView } from './hub-memorial-painting-view.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import type { ModPresentationTextures } from './mod-presentation-assets.ts'
import { nativeLevelUpPresentationFrame } from './level-up-presentation.ts'
import { NativeLevelUpWorldView } from './level-up-world-view.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import { NativeSecondaryWorldView } from './native-secondary-world-view.ts'
import {
  hubNpcMarkerFrame,
  hubStoryOfficePolisherMarkerFrame,
  type HubNpcMarkerSurface,
} from './hub-npc-marker-presentation.ts'

const MEMORATOR_FRAME = { count: 16, height: 170, width: 170 } as const
const HUB_PRIVATE_ROOM_ASSETS: Readonly<Record<HubPrivateRoomAsset, string>> = {
  'library-background': hub.rooms.library.background,
  'library-props': hub.rooms.library.props,
  'mortuary-background': hub.rooms.mortuary.background,
  'mortuary-paintings': hub.rooms.mortuary.paintings,
  'office-background': hub.rooms.office.background,
  'office-prop': hub.rooms.office.prop,
  'storeroom-background': hub.rooms.storeroom.background,
  'storeroom-props': hub.rooms.storeroom.props,
}
const PRIVATE_HUB_REGIONS = ['mortuary', 'library', 'storeroom', 'office'] as const

export class HubPrivateRoomScene {
  readonly world = new Container({ isRenderGroup: true, label: 'college-private-rooms' })
  private readonly rooms: Record<PrivateHubRegionId, Container>
  private readonly players = new Map<string, HubPlayerView>()
  private readonly playerElements = new Map<string, WizardElement>()
  private readonly nonPlayerActors: Record<PrivateHubRegionId, Container[]> = {
    mortuary: [],
    library: [],
    storeroom: [],
    office: [],
  }
  private readonly primarySpells: Record<PrivateHubRegionId, PrimarySpellWorldView>
  private readonly levelUp: NativeLevelUpWorldView
  private readonly secondaryAbilities: Record<PrivateHubRegionId, NativeSecondaryWorldView>
  private readonly livePlayerIds = new Set<string>()
  private readonly mortuaryDynamicPaintings: HubMemorialPaintingView[] = []
  private readonly mortuaryStaticPaintings: Sprite[] = []
  private readonly roomFlames = new Map<PrivateHubRegionId, readonly Sprite[]>()
  private readonly textures: HubWorldTextures
  private memoratorBody!: Sprite
  private memoratorFrames: readonly Texture[] = []
  private readonly dowserClock: HubCommonTraderClock
  private dowserBody!: Sprite
  private readonly polisherClock: HubPolisherClock
  private polisherBody!: Sprite
  private polisherMarker!: Sprite
  private polisherFrames: readonly Texture[] = []
  private readonly markerSprites = new Map<NativeHubInteractionId, Sprite>()
  private readonly modTextures: ModPresentationTextures
  private markerEpochInitialized = false
  private markerEpochSeed = 0
  private markerEpochStartedAtTick = 0
  private activeRegion: PrivateHubRegionId = 'mortuary'

  constructor(
    textures: HubWorldTextures,
    traderAnimationSeed: number,
    renderer: Renderer,
    modTextures: ModPresentationTextures,
  ) {
    this.textures = textures
    this.modTextures = modTextures
    this.dowserClock = createHubCommonTraderClock(traderAnimationSeed ^ 5016)
    this.polisherClock = createHubPolisherClock(traderAnimationSeed ^ 5011)
    this.world.sortableChildren = true
    this.world.eventMode = 'none'
    this.rooms = {
      mortuary: this.createMortuary(),
      library: this.createLibrary(),
      storeroom: this.createStoreroom(),
      office: this.createOffice(),
    }
    this.addMortuaryMemorialGlows(this.rooms.mortuary)
    this.primarySpells = Object.fromEntries(PRIVATE_HUB_REGIONS.map((region) => [
      region,
      new PrimarySpellWorldView(this.rooms[region], textures, {
        postWorldQueueDepth: HUB_PRIVATE_ROOM_EFFECT_DEPTH - 0.5,
      }),
    ])) as Record<PrivateHubRegionId, PrimarySpellWorldView>
    this.levelUp = new NativeLevelUpWorldView(textures.levelUpSparkle)
    this.rooms.mortuary.addChild(this.levelUp.container)
    this.secondaryAbilities = Object.fromEntries(PRIVATE_HUB_REGIONS.map((region) => [
      region,
      new NativeSecondaryWorldView(this.rooms[region], textures, renderer),
    ])) as Record<PrivateHubRegionId, NativeSecondaryWorldView>
    this.world.addChild(
      this.rooms.mortuary,
      this.rooms.library,
      this.rooms.storeroom,
      this.rooms.office,
    )
    this.showRegion('mortuary')
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
    const localParticipant = snapshot.world.participants[localPlayerId]
    if (!localParticipant || localParticipant.region === 'courtyard') return
    if (!this.markerEpochInitialized || this.activeRegion !== localParticipant.region) {
      this.markerEpochInitialized = true
      this.markerEpochSeed = snapshot.world.traderAnimationSeed ^ snapshot.tick
      this.markerEpochStartedAtTick = snapshot.tick
    }
    this.showRegion(localParticipant.region)
    const storyOffice = localParticipant.region === 'office'
      && snapshot.players[localPlayerId]?.economy.collegeIntroPending === true
    this.updatePlayers(snapshot, localParticipant.region)
    for (const region of PRIVATE_HUB_REGIONS) {
      this.primarySpells[region].update(
        snapshot.primarySpells,
        `hub:${region}`,
        presentationFrame,
        pointGainAt,
      )
      this.primarySpells[region].promoteOwnerOverlays((ownerId) => (
        this.players.get(ownerId)?.container.zIndex
      ))
      this.secondaryAbilities[region].update(
        snapshot.secondaryAbilities,
        `hub:${region}`,
        presentationFrame,
        pointGainAt,
      )
    }
    this.updateRoomPresentation(
      snapshot,
      localPlayerId,
      localParticipant.region,
      storyOffice,
    )
    this.updateNpcMarkers(snapshot, markerSurface, storyOffice)
    const room = this.rooms[localParticipant.region]
    if (this.levelUp.container.parent !== room) {
      this.levelUp.container.parent?.removeChild(this.levelUp.container)
      room.addChild(this.levelUp.container)
    }
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

  player(playerId: string): HubPlayerView | undefined {
    return this.players.get(playerId)
  }

  get primarySpellCount(): number {
    return this.primarySpells[this.activeRegion].count
  }

  get primarySpellKinds(): readonly string[] {
    return this.primarySpells[this.activeRegion].kinds
  }

  get levelUpParticleCount(): number {
    return this.levelUp.particleCount
  }

  get secondaryAbilityCount(): number {
    return this.secondaryAbilities[this.activeRegion].count
  }

  get secondaryAbilityKinds(): readonly string[] {
    return this.secondaryAbilities[this.activeRegion].kinds
  }

  get secondaryAbilityPrimitiveCount(): number {
    return this.secondaryAbilities[this.activeRegion].primitiveCount
  }

  get memorialPortraitCount(): number {
    return this.mortuaryDynamicPaintings.filter(({ container }) => container.visible).length
  }

  get secondaryAbilitySamples() {
    return this.secondaryAbilities[this.activeRegion].diagnosticSamples
  }

  get visibleMarkerIds(): readonly NativeHubInteractionId[] {
    return [...this.markerSprites]
      .filter(([, marker]) => marker.visible && marker.parent?.visible !== false)
      .map(([interactionId]) => interactionId)
  }

  destroy(): void {
    this.levelUp.container.parent?.removeChild(this.levelUp.container)
    this.levelUp.destroy()
    for (const view of Object.values(this.primarySpells)) view.destroy()
    for (const view of Object.values(this.secondaryAbilities)) view.destroy()
    for (const view of this.mortuaryDynamicPaintings) view.destroy()
    this.mortuaryDynamicPaintings.length = 0
    this.mortuaryStaticPaintings.length = 0
    this.players.clear()
    this.playerElements.clear()
    this.livePlayerIds.clear()
    this.world.destroy({ children: true })
  }

  private createMortuary(): Container {
    const room = this.room('mortuary')
    const layout = HUB_PRIVATE_ROOM_LAYOUTS.mortuary
    room.addChild(this.layer(
      HUB_PRIVATE_ROOM_ASSETS[layout.architecture.visual.asset],
      0,
    ))
    this.memoratorFrames = this.horizontalFrames(
      hub.rooms.mortuary.memorator,
      MEMORATOR_FRAME.count,
      MEMORATOR_FRAME.width,
      MEMORATOR_FRAME.height,
    )
    const memoratorVisual = layout.actors.memorator.visual
    const memorator = new Container({ label: 'college-mortuary-memorator' })
    memorator.sortableChildren = true
    memorator.position.copyFrom(memoratorVisual.position)
    memorator.zIndex = hubWorldDepthForActor(memoratorVisual.painterY)
    memorator.eventMode = 'none'
    this.memoratorBody = new Sprite(this.memoratorFrames[0])
    this.memoratorBody.anchor.set(0.5)
    this.memoratorBody.eventMode = 'none'
    memorator.addChild(this.memoratorBody)
    this.nonPlayerActors.mortuary.push(memorator)
    room.addChild(memorator)
    this.addNpcMarker(room, 'memorator', hub.rooms.mortuary.memoratorMarker)
    this.addRoomProps(room, layout)
    this.addRoomFlames(room, 'mortuary', hub.rooms.mortuary.flame)
    return room
  }

  private createLibrary(): Container {
    const room = this.room('library')
    const layout = HUB_PRIVATE_ROOM_LAYOUTS.library
    room.addChild(this.layer(
      HUB_PRIVATE_ROOM_ASSETS[layout.architecture.visual.asset],
      0,
    ))
    this.addRoomProps(room, layout)

    const librarianVisual = layout.actors.librarian.visual
    const librarian = new Container({ label: 'college-library-librarian' })
    librarian.sortableChildren = true
    librarian.eventMode = 'none'
    librarian.zIndex = hubWorldDepthForActor(librarianVisual.painterY)
    const counter = this.layer(hub.rooms.library.librarian, 0, 16, 102.5)
    const librarianFrame = this.textures.visualAtlas.frame(
      hub.rooms.library.librarianFrames,
      0,
      0,
    )
    const librarianBody = this.actorTexture(
      librarianFrame,
      librarianVisual.position.x,
      librarianVisual.position.y,
    )
    librarianBody.zIndex = 1
    librarian.addChild(counter, librarianBody)
    this.nonPlayerActors.library.push(librarian)
    room.addChild(librarian)
    this.addNpcMarker(room, 'librarian', hub.rooms.library.librarianMarker)

    const dowserVisual = layout.actors.dowser.visual
    const dowser = new Container({ label: 'college-library-dowser' })
    dowser.sortableChildren = true
    dowser.position.copyFrom(dowserVisual.position)
    dowser.zIndex = hubWorldDepthForActor(dowserVisual.painterY)
    dowser.eventMode = 'none'
    this.dowserBody = new Sprite(this.textures.traders.shlorio[0])
    this.dowserBody.anchor.set(0.5)
    this.dowserBody.eventMode = 'none'
    dowser.addChild(this.dowserBody)
    this.nonPlayerActors.library.push(dowser)
    room.addChild(dowser)
    this.addNpcMarker(room, 'shlorio', hub.rooms.library.dowserMarker)
    this.addRoomFlames(room, 'library', hub.rooms.library.flame)
    room.addChild(this.layer(
      hub.rooms.library.foreground,
      HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
    ))
    for (const mask of HUB_LIBRARY_EXIT_MASKS) {
      const sprite = new Sprite(Texture.WHITE)
      sprite.position.set(mask.x, mask.y)
      sprite.width = mask.width
      sprite.height = mask.height
      sprite.tint = 0x000000
      sprite.zIndex = HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH
      sprite.eventMode = 'none'
      room.addChild(sprite)
    }
    return room
  }

  private createStoreroom(): Container {
    const room = this.room('storeroom')
    const layout = HUB_PRIVATE_ROOM_LAYOUTS.storeroom
    room.addChild(this.layer(
      HUB_PRIVATE_ROOM_ASSETS[layout.architecture.visual.asset],
      0,
    ))
    this.addRoomProps(room, layout)
    this.addRoomFlames(room, 'storeroom', hub.rooms.storeroom.flame)
    room.addChild(this.layer(
      hub.rooms.storeroom.foreground,
      HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
    ))
    return room
  }

  private createOffice(): Container {
    const room = this.room('office')
    const layout = HUB_PRIVATE_ROOM_LAYOUTS.office
    room.addChild(this.layer(
      HUB_PRIVATE_ROOM_ASSETS[layout.architecture.visual.asset],
      0,
    ))
    this.addRoomProps(room, layout)
    const archVisual = layout.actors['arch-chancellor'].visual
    const archChancellor = new Container({ label: 'college-office-arch-chancellor' })
    archChancellor.sortableChildren = true
    archChancellor.eventMode = 'none'
    archChancellor.zIndex = hubWorldDepthForActor(archVisual.painterY)
    const desk = this.layer(hub.rooms.office.desk, 0, 102.5, 102.5)
    const archFrame = this.textures.visualAtlas.frame(
      hub.rooms.office.archChancellor,
      0,
      0,
    )
    const archBody = this.actorTexture(
      archFrame,
      archVisual.position.x,
      archVisual.position.y,
    )
    archBody.zIndex = 1
    archChancellor.addChild(desk, archBody)
    this.nonPlayerActors.office.push(archChancellor)
    room.addChild(archChancellor)
    this.addNpcMarker(room, 'arch-chancellor', hub.rooms.office.archChancellorMarker)
    const polisherDefinition = NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher
    this.polisherFrames = this.textures.visualAtlas.strip(
      hub.rooms.office.polisher,
      4,
      150,
      150,
      'horizontal',
    )
    this.polisherBody = this.actorTexture(
      this.polisherFrames[0]!,
      polisherDefinition.geometry.position.x,
      polisherDefinition.geometry.position.y,
    )
    this.polisherBody.visible = false
    this.polisherMarker = new Sprite(this.textures.base[hub.rooms.office.polisherMarker])
    this.polisherMarker.anchor.set(0.5)
    this.polisherMarker.eventMode = 'none'
    this.polisherMarker.visible = false
    room.addChild(this.polisherBody, this.polisherMarker)
    this.addRoomFlames(room, 'office', hub.rooms.office.flame)
    room.addChild(this.layer(
      hub.rooms.office.foreground,
      HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
    ))
    return room
  }

  private addRoomFlames(
    room: Container,
    region: PrivateHubRegionId,
    source: string,
  ): void {
    const flames = HUB_PRIVATE_ROOM_FLAME_ANCHORS[region].map((position) => {
      const flame = new Sprite(this.textures.base[source])
      flame.position.copyFrom(position)
      flame.zIndex = HUB_PRIVATE_ROOM_EFFECT_DEPTH
      flame.blendMode = 'add'
      flame.eventMode = 'none'
      room.addChild(flame)
      return flame
    })
    this.roomFlames.set(region, flames)
  }

  private addMortuaryMemorialGlows(room: Container): readonly Sprite[] {
    return Array.from({ length: HUB_MORTUARY_MEMORIAL_GLOW.count }, () => {
      const glow = new Sprite(this.textures.base[hub.rooms.mortuary.memorialGlow])
      glow.anchor.set(0.5)
      glow.position.copyFrom(HUB_MORTUARY_MEMORIAL_GLOW.position)
      glow.zIndex = HUB_MORTUARY_MEMORIAL_GLOW.depth
      glow.blendMode = 'add'
      glow.eventMode = 'none'
      room.addChild(glow)
      return glow
    })
  }

  private horizontalFrames(
    source: string,
    count: number,
    width: number,
    height: number,
  ): readonly Texture[] {
    return this.textures.visualAtlas.strip(
      source,
      count,
      width,
      height,
      'horizontal',
    )
  }

  private addRoomProps(
    room: Container,
    layout: HubPrivateRoomLayoutDefinition,
  ): void {
    for (const prop of layout.props) {
      const visual = prop.visual
      if (!visual) continue
      const source = HUB_PRIVATE_ROOM_ASSETS[visual.asset]
      if (visual.kind === 'room-layer') {
        room.addChild(this.layer(source, hubWorldDepthForActor(visual.painterY)))
        continue
      }

      const texture = this.textures.visualAtlas.frame(source, visual.frameIndex, 0)
      if (visual.kind === 'portrait') {
        const sprite = this.actorTexture(texture, visual.position.x, visual.position.y)
        sprite.zIndex = hubWorldDepthForActor(visual.painterY)
        room.addChild(sprite)
        const dynamic = new HubMemorialPaintingView(this.textures)
        dynamic.container.position.copyFrom(visual.position)
        dynamic.container.zIndex = hubWorldDepthForActor(visual.painterY)
        dynamic.container.visible = false
        room.addChild(dynamic.container)
        this.mortuaryStaticPaintings.push(sprite)
        this.mortuaryDynamicPaintings.push(dynamic)
        continue
      }
      const sprite = new Sprite(texture)
      sprite.zIndex = hubWorldDepthForActor(visual.painterY)
      sprite.eventMode = 'none'
      room.addChild(sprite)
    }
  }

  private room(label: PrivateHubRegionId): Container {
    const room = new Container({ label: `college-${label}` })
    room.sortableChildren = true
    room.eventMode = 'none'
    return room
  }

  private showRegion(region: PrivateHubRegionId): void {
    this.activeRegion = region
    for (const [candidate, room] of Object.entries(this.rooms)) {
      room.visible = candidate === region
    }
  }

  private layer(
    source: string,
    zIndex: number,
    x = 0,
    y = 0,
  ): Sprite {
    const sprite = new Sprite(this.textures.base[source])
    sprite.position.set(x, y)
    sprite.zIndex = zIndex
    sprite.eventMode = 'none'
    return sprite
  }

  private actorTexture(texture: Texture, x: number, y: number): Sprite {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.zIndex = hubWorldDepthForActor(y)
    sprite.eventMode = 'none'
    return sprite
  }

  private addNpcMarker(
    room: Container,
    interactionId: NativeHubInteractionId,
    source: string,
  ): void {
    const marker = new Sprite(this.textures.base[source])
    marker.anchor.set(0.5)
    marker.eventMode = 'none'
    this.markerSprites.set(interactionId, marker)
    room.addChild(marker)
  }

  private updateNpcMarkers(
    snapshot: HubPresentationFrame,
    markerSurface: HubNpcMarkerSurface,
    storyOffice: boolean,
  ): void {
    for (const [interactionId, marker] of this.markerSprites) {
      const frame = hubNpcMarkerFrame(
        interactionId,
        Math.max(0, snapshot.tick - this.markerEpochStartedAtTick),
        this.markerEpochSeed,
        [false, false, false],
        { surface: markerSurface },
      )
      marker.visible = frame.visible
      marker.alpha = frame.alpha
      marker.position.copyFrom(frame.position)
      marker.zIndex = hubWorldDepthForActor(
        NATIVE_HUB_NPC_CATALOG.interactions[interactionId].geometry.position.y,
      ) + 0.1
    }
    const polisher = hubStoryOfficePolisherMarkerFrame(
      Math.max(0, snapshot.tick - this.markerEpochStartedAtTick),
      this.markerEpochSeed,
      markerSurface,
    )
    this.polisherMarker.visible = storyOffice && polisher.visible
    this.polisherMarker.alpha = polisher.alpha
    this.polisherMarker.position.copyFrom(polisher.position)
    this.polisherMarker.zIndex = hubWorldDepthForActor(
      NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher.geometry.position.y,
    ) + 0.1
  }

  private updateRoomPresentation(
    snapshot: HubPresentationFrame,
    localPlayerId: string,
    region: PrivateHubRegionId,
    storyOffice: boolean,
  ): void {
    if (region === 'mortuary') {
      for (let index = 0; index < snapshot.world.memorial.slots.length; index += 1) {
        const slot = snapshot.world.memorial.slots[index]!
        this.mortuaryStaticPaintings[index]!.visible = slot.portrait === null
        this.mortuaryDynamicPaintings[index]!.update(slot)
      }
      const player = snapshot.players[localPlayerId]
      if (player) {
        this.memoratorBody.texture = this.memoratorFrames[
          hubMemoratorHeadingIndex(player.position)
        ]
      }
    }
    if (region === 'library') {
      this.dowserBody.texture = this.textures.traders.shlorio[
        this.dowserClock.advanceTo(snapshot.tick)
      ]
    }
    if (region === 'office') {
      this.polisherBody.visible = storyOffice
      if (storyOffice) {
        this.polisherBody.texture = this.polisherFrames[
          this.polisherClock.advanceTo(snapshot.tick)
        ]!
      }
    }
    const flames = this.roomFlames.get(region) ?? []
    for (let index = 0; index < flames.length; index += 1) {
      const transform = hubRoomFlameTransform(region, snapshot.tick, index)
      flames[index].scale.set(transform.scaleX, transform.scaleY)
      flames[index].rotation = transform.rotation
    }
  }

  private updatePlayers(
    snapshot: HubPresentationFrame,
    region: PrivateHubRegionId,
  ): void {
    const live = this.livePlayerIds
    live.clear()
    const room = this.rooms[this.activeRegion]
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      if (snapshot.world.participants[playerId]?.region !== region) continue
      live.add(playerId)
      let view = this.players.get(playerId)
      if (view && this.playerElements.get(playerId) !== player.config.element) {
        this.players.delete(playerId)
        this.playerElements.delete(playerId)
        view.destroy()
        view = undefined
      }
      if (!view) {
        view = new HubPlayerView(player.config.element, this.textures, this.modTextures)
        this.players.set(playerId, view)
        this.playerElements.set(playerId, player.config.element)
        room.addChild(view.container)
      } else if (view.container.parent !== room) {
        view.container.parent?.removeChild(view.container)
        room.addChild(view.container)
      }
      view.setSecondaryState(snapshot.secondaryAbilities.players[playerId], snapshot.tick)
      view.update(
        player,
        snapshot.tick,
        playerStaffActionPose(
          snapshot.primarySpells.transients,
          playerId,
          `hub:${region}`,
        ),
        !(region === 'office' && player.economy.collegeIntroPending),
      )
    }
    for (const [playerId, view] of this.players) {
      if (live.has(playerId)) continue
      this.players.delete(playerId)
      this.playerElements.delete(playerId)
      view.destroy()
    }
  }
}
