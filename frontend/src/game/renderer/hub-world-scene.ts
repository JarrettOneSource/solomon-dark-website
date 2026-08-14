import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  HUB_ASTRONOMER_ROOT,
  HUB_ASTRONOMER_TELESCOPE_ORIGIN,
  HUB_SOUTHERN_EAST_PLATFORM_ORIGIN,
  HUB_SOUTHERN_EXTENT,
  HUB_SOUTHERN_WEST_PLATFORM_ORIGIN,
} from '../hub-camera-presentation.ts'
import {
  hubAstronomerFrameAt,
  hubAstronomerLocalTick,
  type HubAstronomerAssistantFrame,
  type HubAstronomerMainActorFrame,
} from '../hub-astronomer.ts'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  hubFountainParticleAlpha,
  hubMarkerAlpha,
  hubPotionTraderActorFrameAt,
  hubPotionTraderBalloonFrameAt,
  hubPotionTraderBalloonOffsetYAt,
  hubSealColors,
  hubStatueOffsets,
  type HubColor,
} from '../hub-presentation.ts'
import {
  HUB_TEACHER_CAST_ORIGIN,
  HUB_TEACHER_RUNE_ALPHA,
  HUB_TEACHER_RUNE_CENTER,
  hubTeacherBurstAt,
  hubTeacherFrameAt,
} from '../hub-teacher.ts'
import { HubPlayerView, HubStudentView, actorSprite } from './hub-actors.ts'
import {
  HUB_COURTYARD_DEPTH_PROP_FRAME,
  HUB_COURTYARD_DEPTH_PROPS,
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  hubWorldDepthForActor,
  hubStudentIntersectsView,
  spriteFrameIndex,
} from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'

export class HubWorldScene {
  readonly stage = new Container({ label: 'college-courtyard-camera-banks' })
  readonly world = new Container({ isRenderGroup: true, label: 'college-courtyard' })
  readonly southern = new Container({
    isRenderGroup: true,
    label: 'college-courtyard-southern-bank',
  })
  private readonly sealGlyphs: Sprite
  private readonly sealCore: Sprite
  private readonly markerSprites: Sprite[] = []
  private readonly fountain = new Map<number, Sprite>()
  private readonly liveFountainIds = new Set<number>()
  private readonly statueAura: Sprite
  private readonly statueBody: Sprite
  private readonly astronomer: HubAstronomerView
  private readonly potion: HubPotionTraderView
  private readonly teacher: HubTeacherView
  private readonly players = new Map<string, HubPlayerView>()
  private readonly playerElements = new Map<string, WizardElement>()
  private readonly primarySpells: PrimarySpellWorldView
  private readonly livePlayerIds = new Set<string>()
  private readonly students = new Map<number, HubStudentView>()
  private readonly retiredStudentViews: HubStudentView[] = []
  private readonly liveStudentIds = new Set<number>()
  private readonly southernArchitecture: Sprite[] = []
  private readonly textures: HubWorldTextures
  private readonly layerFrameTextures: Texture[] = []
  private createdStudentViewCount = 0
  private reusedStudentViewCount = 0

  constructor(textures: HubWorldTextures, createdAtTick: number) {
    this.textures = textures
    this.stage.eventMode = 'none'
    this.world.sortableChildren = true
    this.world.eventMode = 'none'
    this.southern.sortableChildren = true
    this.southern.eventMode = 'none'
    this.stage.addChild(this.world, this.southern)
    this.primarySpells = new PrimarySpellWorldView(this.world, textures)
    this.world.addChild(this.worldLayer(textures.base[hub.courtyard], HUB_WORLD_DEPTH.courtyard))
    this.sealGlyphs = this.worldLayer(textures.base[hub.seals.glyphs], HUB_WORLD_DEPTH.sealGlyphs, HUB_WORLD_LAYER_BOUNDS.sealGlyphs)
    this.sealGlyphs.blendMode = 'add'
    this.sealCore = this.worldLayer(textures.base[hub.seals.core], HUB_WORLD_DEPTH.sealCore, HUB_WORLD_LAYER_BOUNDS.sealCore)
    this.sealCore.blendMode = 'add'
    this.world.addChild(this.sealGlyphs, this.sealCore)
    this.world.addChild(this.worldLayer(textures.base[hub.tent.shadow], HUB_WORLD_DEPTH.usefulThyngsShadow, HUB_WORLD_LAYER_BOUNDS.usefulThyngsShadow))
    this.world.addChild(this.worldLayer(textures.base[hub.tent.back], HUB_WORLD_DEPTH.usefulThyngsBack, HUB_WORLD_LAYER_BOUNDS.usefulThyngsBack))

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

    this.addNpc(hub.npcs.perkWitch, hub.markers.help.right, 1340, 280)
    this.addNpc(hub.npcs.annalist, hub.markers.talk.right, 895.5, 455.5)
    this.addNpc(hub.npcs.items, hub.markers.help.right, 1700.5, 449.5)

    this.potion = new HubPotionTraderView(textures)
    this.markerSprites.push(this.potion.marker)
    this.world.addChild(this.potion.actor, this.potion.balloons, this.potion.marker)

    this.teacher = new HubTeacherView(textures, 576.5, 710.5)
    this.world.addChild(this.teacher.container)

    this.astronomer = new HubAstronomerView(textures, createdAtTick)

    this.addCourtyardDepthProps()
    this.world.addChild(this.worldLayer(textures.base[hub.tent.front], HUB_WORLD_DEPTH.usefulThyngsFront, HUB_WORLD_LAYER_BOUNDS.usefulThyngsFront))
    this.world.addChild(this.worldLayer(
      textures.base[hub.foreground.courtyard],
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

  update(snapshot: HubPresentationFrame): void {
    const ambient = snapshot.world.ambient
    const colors = hubSealColors(ambient)
    this.sealGlyphs.tint = colorTint(colors.glyphs)
    this.sealGlyphs.alpha = colors.glyphs.alpha
    this.sealCore.tint = colorTint(colors.core)
    this.sealCore.alpha = colors.core.alpha
    const markerAlpha = hubMarkerAlpha(ambient)
    for (const marker of this.markerSprites) marker.alpha = markerAlpha
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
    this.teacher.update(snapshot.tick / 100)
    this.astronomer.update(snapshot.tick)
    this.updateStudents(snapshot)
    this.updatePlayers(snapshot)
    this.primarySpells.update(snapshot.primarySpells, 'hub:courtyard')
  }

  player(playerId: string): HubPlayerView | undefined {
    return this.players.get(playerId)
  }

  get studentCount(): number {
    return this.students.size
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

  destroy(): void {
    this.primarySpells.destroy()
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
    for (const texture of this.layerFrameTextures) texture.destroy(false)
    this.layerFrameTextures.length = 0
  }

  private addNpc(source: string, markerSource: string, x: number, y: number): void {
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
    const marker = new Sprite(this.textures.base[markerSource])
    marker.anchor.set(0.5)
    marker.position.set(48, -60)
    marker.zIndex = 2
    marker.eventMode = 'none'
    this.markerSprites.push(marker)
    actor.addChild(shadow, body, marker)
    this.world.addChild(actor)
  }

  private addCourtyardDepthProps(): void {
    const source = this.textures.base[hub.foreground.depthProps]
    for (let index = 0; index < HUB_COURTYARD_DEPTH_PROPS.length; index += 1) {
      const texture = new Texture({
        source: source.source,
        frame: new Rectangle(
          index * HUB_COURTYARD_DEPTH_PROP_FRAME.width,
          0,
          HUB_COURTYARD_DEPTH_PROP_FRAME.width,
          HUB_COURTYARD_DEPTH_PROP_FRAME.height,
        ),
      })
      this.layerFrameTextures.push(texture)
      const sprite = new Sprite(texture)
      sprite.position.set(
        HUB_COURTYARD_DEPTH_PROP_FRAME.x,
        HUB_COURTYARD_DEPTH_PROP_FRAME.y,
      )
      sprite.zIndex = hubWorldDepthForActor(HUB_COURTYARD_DEPTH_PROPS[index].actorY)
      sprite.eventMode = 'none'
      this.world.addChild(sprite)
    }
  }

  private worldLayer(
    source: Texture,
    zIndex: number,
    bounds?: { x: number; y: number; width: number; height: number },
  ): Sprite {
    const texture = bounds
      ? new Texture({
          source: source.source,
          frame: new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height),
        })
      : source
    if (bounds) this.layerFrameTextures.push(texture)
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
      if (snapshot.world.participants[playerId]?.region !== 'courtyard') continue
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
        this.world.addChild(view.container)
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
  private readonly createdAtTick: number
  private readonly textures: HubWorldTextures
  private currentTelescopeFrame = 0

  constructor(textures: HubWorldTextures, createdAtTick: number) {
    this.textures = textures
    this.createdAtTick = createdAtTick
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
    const frame = hubAstronomerFrameAt(hubAstronomerLocalTick(tick, this.createdAtTick))
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

class HubPotionTraderView {
  readonly actor = new Container({ label: 'potion-trader' })
  readonly balloons: Sprite
  readonly marker: Sprite
  private readonly sprite: Sprite
  private readonly textures: HubWorldTextures

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.actor.position.set(1397, 664)
    this.actor.zIndex = hubWorldDepthForActor(664)
    this.actor.eventMode = 'none'
    this.sprite = new Sprite(textures.potion.actor[0])
    this.sprite.position.set(-12, -46)
    this.sprite.eventMode = 'none'
    this.actor.addChild(this.sprite)

    this.balloons = new Sprite(textures.potion.balloons[0])
    this.balloons.position.set(1320, 516)
    this.balloons.zIndex = HUB_WORLD_DEPTH.usefulThyngsBalloons
    this.balloons.eventMode = 'none'

    this.marker = new Sprite(textures.base[hub.markers.help.right])
    this.marker.anchor.set(0.5)
    this.marker.position.set(1435, 602)
    this.marker.zIndex = HUB_WORLD_DEPTH.usefulThyngsMarker
    this.marker.eventMode = 'none'
  }

  update(tick: number): void {
    this.sprite.texture = this.textures.potion.actor[hubPotionTraderActorFrameAt(tick)]
    this.balloons.texture = this.textures.potion.balloons[hubPotionTraderBalloonFrameAt(tick)]
    this.balloons.position.y = 516 + hubPotionTraderBalloonOffsetYAt(tick)
  }
}

class HubTeacherView {
  readonly container = new Container({ label: 'teacher' })
  private readonly rune: Sprite
  private readonly actor: Sprite
  private readonly burst: Container
  private readonly column: Sprite
  private readonly flare: Sprite
  private readonly core: Sprite
  private readonly frames: Sprite
  private readonly textures: HubWorldTextures
  private currentFrame = 0

  constructor(textures: HubWorldTextures, x: number, y: number) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.position.set(x, y)
    this.container.zIndex = hubWorldDepthForActor(y)
    this.container.eventMode = 'none'
    this.rune = actorSprite(textures.base[hub.npcs.teacher.rune], 0)
    this.rune.position.set(HUB_TEACHER_RUNE_CENTER.x, HUB_TEACHER_RUNE_CENTER.y)
    this.rune.alpha = HUB_TEACHER_RUNE_ALPHA
    const shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 1)
    shadow.scale.set(1.25)
    this.actor = actorSprite(textures.teacher.actor[0], 2)
    this.burst = new Container({ label: 'teacher-cast-release' })
    this.burst.position.set(HUB_TEACHER_CAST_ORIGIN.x, HUB_TEACHER_CAST_ORIGIN.y)
    this.burst.zIndex = 3
    this.burst.blendMode = 'screen'
    this.column = centered(textures.base[hub.npcs.teacher.burst.column])
    this.flare = centered(textures.base[hub.npcs.teacher.burst.flare])
    this.core = centered(textures.base[hub.npcs.teacher.burst.core])
    this.frames = centered(textures.teacher.burst[0])
    this.burst.addChild(this.column, this.flare, this.core, this.frames)
    this.container.addChild(this.rune, shadow, this.actor, this.burst)
  }

  update(elapsedSeconds: number): void {
    this.currentFrame = hubTeacherFrameAt(elapsedSeconds)
    this.actor.texture = this.textures.teacher.actor[this.currentFrame]
    const burst = hubTeacherBurstAt(elapsedSeconds)
    this.burst.visible = burst.visible
    if (!burst.visible) return
    this.column.alpha = burst.column.alpha
    this.column.scale.set(burst.column.scaleX, burst.column.scaleY)
    this.flare.alpha = burst.flare.alpha
    this.flare.scale.set(burst.flare.scale)
    this.core.alpha = burst.core.alpha
    this.core.scale.set(burst.core.scale)
    this.frames.texture = this.textures.teacher.burst[spriteFrameIndex(burst.frame, 11)]
    this.frames.alpha = 1 - burst.frame / 11
  }

  get frame(): number {
    return this.currentFrame
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
