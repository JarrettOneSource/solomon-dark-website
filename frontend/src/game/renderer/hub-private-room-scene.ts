import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import type { HubRegionId } from '../core-kernels/hub-regions.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import { HubPlayerView } from './hub-actors.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'

type PrivateHubRegionId = Exclude<HubRegionId, 'courtyard'>

const MORTUARY_PAINTINGS = [
  [512, 697],
  [350, 683],
  [673, 683],
  [744, 540],
  [590, 540],
  [434, 540],
  [279, 540],
  [354, 400],
  [512, 400],
  [670, 400],
] as const

const MORTUARY_PAINTING_FRAME = { height: 224, width: 74 } as const
const STOREROOM_PROP_DEPTHS = [324, 434, 542.5] as const
const LIBRARY_PROP_DEPTHS = [788, 678.5, 732.5] as const

export class HubPrivateRoomScene {
  readonly world = new Container({ label: 'college-private-rooms' })
  private readonly rooms: Record<PrivateHubRegionId, Container>
  private readonly players = new Map<string, HubPlayerView>()
  private readonly playerElements = new Map<string, WizardElement>()
  private readonly livePlayerIds = new Set<string>()
  private readonly derivedTextures: Texture[] = []
  private readonly textures: HubWorldTextures
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
    room.addChild(this.actor(hub.rooms.mortuary.memorator, 628, 770))
    const paintingSource = this.textures.base[hub.rooms.mortuary.paintings]
    for (let index = 0; index < MORTUARY_PAINTINGS.length; index += 1) {
      const [x, y] = MORTUARY_PAINTINGS[index]
      const texture = new Texture({
        source: paintingSource.source,
        frame: new Rectangle(
          index * MORTUARY_PAINTING_FRAME.width,
          0,
          MORTUARY_PAINTING_FRAME.width,
          MORTUARY_PAINTING_FRAME.height,
        ),
      })
      this.derivedTextures.push(texture)
      room.addChild(this.actorTexture(texture, x, y + 5))
    }
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
    room.addChild(this.layer(hub.rooms.library.foreground, 2_000_000))
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
    room.addChild(this.layer(hub.rooms.storeroom.foreground, 2_000_000))
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
    room.addChild(this.layer(hub.rooms.office.foreground, 2_000_000))
    return room
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

  private actor(source: string, x: number, y: number): Sprite {
    return this.actorTexture(this.textures.base[source], x, y)
  }

  private actorTexture(texture: Texture, x: number, y: number): Sprite {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.zIndex = hubWorldDepthForActor(y)
    sprite.eventMode = 'none'
    return sprite
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
