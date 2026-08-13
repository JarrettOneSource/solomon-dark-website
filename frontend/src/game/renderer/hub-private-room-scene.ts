import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import { hubMarkerAlpha } from '../hub-presentation.ts'
import { HubPlayerView } from './hub-actors.ts'
import {
  HUB_LIBRARY_EXIT_MASKS,
  HUB_MEMORATOR_POSITION,
  HUB_MORTUARY_PAINTINGS,
  HUB_PRIVATE_ROOM_EFFECT_DEPTH,
  HUB_PRIVATE_ROOM_FLAME_ANCHORS,
  HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
  hubMemoratorHeadingIndex,
  hubRoomFlameTransform,
  type PrivateHubRegionId,
} from './hub-private-room-presentation.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'

const MORTUARY_PAINTING_FRAME = { height: 224, width: 74 } as const
const MEMORATOR_FRAME = { count: 16, height: 170, width: 170 } as const
const STOREROOM_PROP_DEPTHS = [324, 434, 542.5] as const
const LIBRARY_PROP_DEPTHS = [788, 678.5, 732.5] as const

export class HubPrivateRoomScene {
  readonly world = new Container({ label: 'college-private-rooms' })
  private readonly rooms: Record<PrivateHubRegionId, Container>
  private readonly players = new Map<string, HubPlayerView>()
  private readonly playerElements = new Map<string, WizardElement>()
  private readonly livePlayerIds = new Set<string>()
  private readonly derivedTextures: Texture[] = []
  private readonly roomFlames = new Map<PrivateHubRegionId, readonly Sprite[]>()
  private readonly textures: HubWorldTextures
  private memoratorBody!: Sprite
  private memoratorMarker!: Sprite
  private memoratorFrames: readonly Texture[] = []
  private activeRegion: PrivateHubRegionId = 'mortuary'

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.world.sortableChildren = true
    this.world.eventMode = 'none'
    this.rooms = {
      mortuary: this.createMortuary(),
      library: this.createLibrary(),
      storeroom: this.createStoreroom(),
      office: this.createOffice(),
    }
    this.world.addChild(
      this.rooms.mortuary,
      this.rooms.library,
      this.rooms.storeroom,
      this.rooms.office,
    )
    this.showRegion('mortuary')
  }

  update(snapshot: HubPresentationFrame, localPlayerId: string): void {
    const localParticipant = snapshot.world.participants[localPlayerId]
    if (!localParticipant || localParticipant.region === 'courtyard') return
    this.showRegion(localParticipant.region)
    this.updatePlayers(snapshot, localParticipant.region)
    this.updateRoomPresentation(snapshot, localPlayerId, localParticipant.region)
  }

  player(playerId: string): HubPlayerView | undefined {
    return this.players.get(playerId)
  }

  destroy(): void {
    this.players.clear()
    this.playerElements.clear()
    this.livePlayerIds.clear()
    this.world.destroy({ children: true })
    for (const texture of this.derivedTextures) texture.destroy(false)
    this.derivedTextures.length = 0
  }

  private createMortuary(): Container {
    const room = this.room('mortuary')
    room.addChild(this.layer(hub.rooms.mortuary.background, 0))
    this.memoratorFrames = this.horizontalFrames(
      hub.rooms.mortuary.memorator,
      MEMORATOR_FRAME.count,
      MEMORATOR_FRAME.width,
      MEMORATOR_FRAME.height,
    )
    const memorator = new Container({ label: 'college-mortuary-memorator' })
    memorator.sortableChildren = true
    memorator.position.set(HUB_MEMORATOR_POSITION.x, HUB_MEMORATOR_POSITION.y)
    memorator.zIndex = hubWorldDepthForActor(HUB_MEMORATOR_POSITION.y)
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
    const paintingSource = this.textures.base[hub.rooms.mortuary.paintings]
    for (const painting of HUB_MORTUARY_PAINTINGS) {
      const texture = new Texture({
        source: paintingSource.source,
        frame: new Rectangle(
          painting.portraitId * MORTUARY_PAINTING_FRAME.width,
          0,
          MORTUARY_PAINTING_FRAME.width,
          MORTUARY_PAINTING_FRAME.height,
        ),
      })
      this.derivedTextures.push(texture)
      room.addChild(this.actorTexture(texture, painting.x, painting.y + 5))
    }
    this.addRoomFlames(room, 'mortuary', hub.rooms.mortuary.flame)
    return room
  }

  private createLibrary(): Container {
    const room = this.room('library')
    room.addChild(this.layer(hub.rooms.library.background, 0))
    this.addRoomLayerStrip(
      room,
      hub.rooms.library.props,
      1024,
      1024,
      LIBRARY_PROP_DEPTHS,
    )

    const librarian = new Container({ label: 'college-library-librarian' })
    librarian.sortableChildren = true
    librarian.eventMode = 'none'
    librarian.zIndex = hubWorldDepthForActor(595)
    const counter = this.layer(hub.rooms.library.librarian, 0, 16, 102.5)
    const librarianSource = this.textures.base[hub.rooms.library.librarianFrames]
    const librarianFrame = new Texture({
      source: librarianSource.source,
      frame: new Rectangle(0, 0, 150, 150),
    })
    this.derivedTextures.push(librarianFrame)
    const librarianBody = this.actorTexture(librarianFrame, 512, 538)
    librarianBody.zIndex = 1
    librarian.addChild(counter, librarianBody)
    room.addChild(librarian)

    const dowserSource = this.textures.base[hub.rooms.library.dowser]
    const dowserFrame = new Texture({
      source: dowserSource.source,
      frame: new Rectangle(0, 0, 150, 150),
    })
    this.derivedTextures.push(dowserFrame)
    room.addChild(this.actorTexture(dowserFrame, 900, 642.5))
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
    room.addChild(this.layer(hub.rooms.storeroom.background, 0))
    this.addRoomLayerStrip(
      room,
      hub.rooms.storeroom.props,
      1075,
      800,
      STOREROOM_PROP_DEPTHS,
    )
    this.addRoomFlames(room, 'storeroom', hub.rooms.storeroom.flame)
    room.addChild(this.layer(
      hub.rooms.storeroom.foreground,
      HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH,
    ))
    return room
  }

  private createOffice(): Container {
    const room = this.room('office')
    room.addChild(this.layer(hub.rooms.office.background, 0))
    room.addChild(this.layer(
      hub.rooms.office.prop,
      hubWorldDepthForActor(681),
    ))
    const archChancellor = new Container({ label: 'college-office-arch-chancellor' })
    archChancellor.sortableChildren = true
    archChancellor.eventMode = 'none'
    archChancellor.zIndex = hubWorldDepthForActor(467)
    const desk = this.layer(hub.rooms.office.desk, 0, 102.5, 102.5)
    const archSource = this.textures.base[hub.rooms.office.archChancellor]
    const archFrame = new Texture({
      source: archSource.source,
      frame: new Rectangle(0, 0, 150, 150),
    })
    this.derivedTextures.push(archFrame)
    const archBody = this.actorTexture(archFrame, 518, 412)
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

  private addRoomLayerStrip(
    room: Container,
    source: string,
    frameWidth: number,
    frameHeight: number,
    depths: readonly number[],
  ): void {
    const sourceTexture = this.textures.base[source]
    for (let index = 0; index < depths.length; index += 1) {
      const texture = new Texture({
        source: sourceTexture.source,
        frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
      })
      this.derivedTextures.push(texture)
      const sprite = new Sprite(texture)
      sprite.zIndex = hubWorldDepthForActor(depths[index])
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
