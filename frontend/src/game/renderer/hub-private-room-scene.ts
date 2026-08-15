import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import {
  HUB_PRIVATE_ROOM_LAYOUTS,
  type HubPrivateRoomAsset,
  type HubPrivateRoomLayoutDefinition,
  type PrivateHubRegionId,
} from '../core-kernels/hub-private-room-layout.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  createHubCommonTraderClock,
  hubMarkerAlpha,
  type HubCommonTraderClock,
} from '../hub-presentation.ts'
import { HubPlayerView } from './hub-actors.ts'
import {
  HUB_LIBRARY_EXIT_MASKS,
  HUB_PRIVATE_ROOM_EFFECT_DEPTH,
  HUB_PRIVATE_ROOM_FLAME_ANCHORS,
  HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
  hubMemoratorHeadingIndex,
  hubRoomFlameTransform,
} from './hub-private-room-presentation.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'

const MORTUARY_PAINTING_FRAME = { height: 224, width: 74 } as const
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
  private readonly primarySpells: Record<PrivateHubRegionId, PrimarySpellWorldView>
  private readonly livePlayerIds = new Set<string>()
  private readonly derivedTextures: Texture[] = []
  private readonly roomFlames = new Map<PrivateHubRegionId, readonly Sprite[]>()
  private readonly textures: HubWorldTextures
  private memoratorBody!: Sprite
  private memoratorMarker!: Sprite
  private memoratorFrames: readonly Texture[] = []
  private readonly dowserClock: HubCommonTraderClock
  private dowserBody!: Sprite
  private dowserMarker!: Sprite
  private activeRegion: PrivateHubRegionId = 'mortuary'

  constructor(textures: HubWorldTextures, traderAnimationSeed: number) {
    this.textures = textures
    this.dowserClock = createHubCommonTraderClock(traderAnimationSeed ^ 5016)
    this.world.sortableChildren = true
    this.world.eventMode = 'none'
    this.rooms = {
      mortuary: this.createMortuary(),
      library: this.createLibrary(),
      storeroom: this.createStoreroom(),
      office: this.createOffice(),
    }
    this.primarySpells = Object.fromEntries(PRIVATE_HUB_REGIONS.map((region) => [
      region,
      new PrimarySpellWorldView(this.rooms[region], textures, {
        postWorldQueueDepth: HUB_PRIVATE_ROOM_EFFECT_DEPTH - 0.5,
      }),
    ])) as Record<PrivateHubRegionId, PrimarySpellWorldView>
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
  ): void {
    const localParticipant = snapshot.world.participants[localPlayerId]
    if (!localParticipant || localParticipant.region === 'courtyard') return
    this.showRegion(localParticipant.region)
    this.updatePlayers(snapshot, localParticipant.region)
    for (const region of PRIVATE_HUB_REGIONS) {
      this.primarySpells[region].update(
        snapshot.primarySpells,
        `hub:${region}`,
        presentationFrame,
      )
      this.primarySpells[region].promoteOwnerOverlays((ownerId) => (
        this.players.get(ownerId)?.container.zIndex
      ))
    }
    this.updateRoomPresentation(snapshot, localPlayerId, localParticipant.region)
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

  destroy(): void {
    for (const view of Object.values(this.primarySpells)) view.destroy()
    this.players.clear()
    this.playerElements.clear()
    this.livePlayerIds.clear()
    this.world.destroy({ children: true })
    for (const texture of this.derivedTextures) texture.destroy(false)
    this.derivedTextures.length = 0
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
    this.memoratorMarker = new Sprite(this.textures.base[hub.rooms.mortuary.memoratorMarker])
    this.memoratorMarker.anchor.set(0.5)
    this.memoratorMarker.position.set(-1, -28)
    this.memoratorMarker.zIndex = 1
    this.memoratorMarker.eventMode = 'none'
    memorator.addChild(this.memoratorBody, this.memoratorMarker)
    room.addChild(memorator)
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
    const librarianSource = this.textures.base[hub.rooms.library.librarianFrames]
    const librarianFrame = new Texture({
      source: librarianSource.source,
      frame: new Rectangle(0, 0, 150, 150),
    })
    this.derivedTextures.push(librarianFrame)
    const librarianBody = this.actorTexture(
      librarianFrame,
      librarianVisual.position.x,
      librarianVisual.position.y,
    )
    librarianBody.zIndex = 1
    librarian.addChild(counter, librarianBody)
    room.addChild(librarian)

    const dowserVisual = layout.actors.dowser.visual
    const dowser = new Container({ label: 'college-library-dowser' })
    dowser.sortableChildren = true
    dowser.position.copyFrom(dowserVisual.position)
    dowser.zIndex = hubWorldDepthForActor(dowserVisual.painterY)
    dowser.eventMode = 'none'
    this.dowserBody = new Sprite(this.textures.traders.shlorio[0])
    this.dowserBody.anchor.set(0.5)
    this.dowserBody.eventMode = 'none'
    this.dowserMarker = new Sprite(this.textures.base[hub.markers.help.right])
    this.dowserMarker.anchor.set(0.5)
    this.dowserMarker.position.set(48, -60)
    this.dowserMarker.zIndex = 1
    this.dowserMarker.eventMode = 'none'
    dowser.addChild(this.dowserBody, this.dowserMarker)
    room.addChild(dowser)
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
    const archSource = this.textures.base[hub.rooms.office.archChancellor]
    const archFrame = new Texture({
      source: archSource.source,
      frame: new Rectangle(0, 0, 150, 150),
    })
    this.derivedTextures.push(archFrame)
    const archBody = this.actorTexture(
      archFrame,
      archVisual.position.x,
      archVisual.position.y,
    )
    archBody.zIndex = 1
    archChancellor.addChild(desk, archBody)
    room.addChild(archChancellor)
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

  private horizontalFrames(
    source: string,
    count: number,
    width: number,
    height: number,
  ): readonly Texture[] {
    const sourceTexture = this.textures.base[source]
    const frames = Array.from({ length: count }, (_, index) => new Texture({
      source: sourceTexture.source,
      frame: new Rectangle(index * width, 0, width, height),
    }))
    this.derivedTextures.push(...frames)
    return frames
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

      const frameWidth = visual.kind === 'portrait'
        ? MORTUARY_PAINTING_FRAME.width
        : layout.width
      const frameHeight = visual.kind === 'portrait'
        ? MORTUARY_PAINTING_FRAME.height
        : layout.height
      const sourceTexture = this.textures.base[source]
      const texture = new Texture({
        source: sourceTexture.source,
        frame: new Rectangle(visual.frameIndex * frameWidth, 0, frameWidth, frameHeight),
      })
      this.derivedTextures.push(texture)
      if (visual.kind === 'portrait') {
        const sprite = this.actorTexture(texture, visual.position.x, visual.position.y)
        sprite.zIndex = hubWorldDepthForActor(visual.painterY)
        room.addChild(sprite)
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

  private updateRoomPresentation(
    snapshot: HubPresentationFrame,
    localPlayerId: string,
    region: PrivateHubRegionId,
  ): void {
    if (region === 'mortuary') {
      const player = snapshot.players[localPlayerId]
      if (player) {
        this.memoratorBody.texture = this.memoratorFrames[
          hubMemoratorHeadingIndex(player.position)
        ]
      }
      this.memoratorMarker.alpha = hubMarkerAlpha(snapshot.world.ambient)
    }
    if (region === 'library') {
      this.dowserBody.texture = this.textures.traders.shlorio[
        this.dowserClock.advanceTo(snapshot.tick)
      ]
      this.dowserMarker.alpha = hubMarkerAlpha(snapshot.world.ambient)
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
        view = new HubPlayerView(player.config.element, this.textures)
        this.players.set(playerId, view)
        this.playerElements.set(playerId, player.config.element)
        room.addChild(view.container)
      } else if (view.container.parent !== room) {
        view.container.parent?.removeChild(view.container)
        room.addChild(view.container)
      }
      view.update(player, snapshot.tick)
    }
    for (const [playerId, view] of this.players) {
      if (live.has(playerId)) continue
      this.players.delete(playerId)
      this.playerElements.delete(playerId)
      view.destroy()
    }
  }
}
