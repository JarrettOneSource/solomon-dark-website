import { Container, Sprite, type Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import { playerHitOverlayAlpha } from '../core-kernels/player-combat.ts'
import {
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from '../hub-presentation.ts'
import type {
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import {
  createPlayerCharacterDrawPlan,
  createPlayerDeathDrawPlan,
} from '../player-character-presentation.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { hubWorldDepthForActor, spriteFrameIndex } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export class PlayerWorldView {
  readonly container = new Container({ label: 'local-player' })
  private readonly shadow: Sprite
  private readonly staffBack: Sprite
  private readonly orb: NativeElementVfxView
  private readonly robe: Sprite
  private readonly fixed: Sprite
  private readonly staffFront: Sprite
  private readonly head: Sprite
  private readonly deathBody: Sprite
  private readonly deathAttachment: Sprite
  private readonly hitOverlay: Container
  private readonly hitStaffBack: Sprite
  private readonly hitRobe: Sprite
  private readonly hitFixed: Sprite
  private readonly hitStaffFront: Sprite
  private readonly hitHead: Sprite
  private readonly textures: PlayerWorldTextures
  private currentWalkPose = 0
  private currentAttachmentPose = 0

  constructor(
    element: WizardElement,
    textures: PlayerWorldTextures,
  ) {
    this.textures = textures
    const playerTextures = textures.players[element]
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.shadow = actorSprite(textures.playerShadow, 0)
    this.shadow.scale.set(1.25)
    this.shadow.alpha = 0.72
    this.staffBack = actorSprite(playerTextures.staffBack[0][0], 1)
    this.orb = new NativeElementVfxView(element, textures.elementVfx)
    this.orb.container.zIndex = 2
    this.robe = actorSprite(playerTextures.robe[0][0], 3)
    this.fixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.staffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.head = actorSprite(playerTextures.head[0], 7)
    this.deathBody = actorSprite(playerTextures.death[0][0], 3)
    this.deathAttachment = actorSprite(playerTextures.deathAttachment[0][0], 4)
    this.hitOverlay = new Container({ label: 'player-hit-overlay' })
    this.hitOverlay.sortableChildren = true
    this.hitOverlay.eventMode = 'none'
    this.hitOverlay.zIndex = 8
    this.hitStaffBack = actorSprite(playerTextures.staffBack[0][0], 1)
    this.hitRobe = actorSprite(playerTextures.robe[0][0], 3)
    this.hitFixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.hitStaffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.hitHead = actorSprite(playerTextures.head[0], 7)
    for (const sprite of [
      this.hitStaffBack,
      this.hitRobe,
      this.hitFixed,
      this.hitStaffFront,
      this.hitHead,
    ]) sprite.tint = 0xff0000
    this.hitOverlay.addChild(
      this.hitStaffBack,
      this.hitRobe,
      this.hitFixed,
      this.hitStaffFront,
      this.hitHead,
    )
    this.container.addChild(
      this.shadow,
      this.staffBack,
      this.orb.container,
      this.robe,
      this.fixed,
      this.staffFront,
      this.head,
      this.deathBody,
      this.deathAttachment,
      this.hitOverlay,
    )
  }

  update(player: ProtocolPlayerState, tick: number): void {
    const playerTextures = this.textures.players[player.config.element]
    const plan = createPlayerCharacterDrawPlan(player)
    const heading = spriteFrameIndex(Math.round(player.headingIndex), 24)
    const pose = spriteFrameIndex(plan.robePose, 5)
    const attachmentPose = plan.attachmentPose
    this.currentAttachmentPose = attachmentPose
    this.currentWalkPose = pose
    const fixedOffset = plan.fixedRobeOffset
    const attachmentOffset = plan.frontAttachmentOffset
    const headOffset = plan.headOffset
    const orbOffset = plan.orbOffset
    const staffFront = plan.staffFront
    const death = createPlayerDeathDrawPlan(
      player.headingIndex,
      player.progression.lifeState,
      player.progression.deathTick,
    )

    this.container.position.set(player.position.x, player.position.y)
    this.container.zIndex = hubWorldDepthForActor(player.position.y)
    this.shadow.visible = !death.visible
    this.staffBack.visible = !death.visible && !staffFront
    this.orb.container.visible = !death.visible
    this.robe.visible = !death.visible
    this.fixed.visible = !death.visible
    this.staffFront.visible = !death.visible && staffFront
    this.head.visible = !death.visible
    this.deathBody.visible = death.visible
    this.deathAttachment.visible = death.visible
    const hitAlpha = playerHitOverlayAlpha(player.progression, tick)
    this.hitOverlay.alpha = hitAlpha
    this.hitOverlay.visible = !death.visible && hitAlpha > 0
    this.hitStaffBack.visible = !staffFront
    this.hitRobe.visible = true
    this.hitFixed.visible = true
    this.hitStaffFront.visible = staffFront
    this.hitHead.visible = true
    this.deathBody.texture = playerTextures.death[death.facing][death.frame]
    this.deathAttachment.texture = playerTextures.deathAttachment[death.facing][death.frame]
    this.staffBack.texture = playerTextures.staffBack[heading][attachmentPose]
    this.robe.texture = playerTextures.robe[heading][pose]
    this.fixed.texture = playerTextures.fixed[heading][attachmentPose]
    this.fixed.position.set(fixedOffset.x, fixedOffset.y)
    this.staffFront.texture = playerTextures.staffFront[heading][attachmentPose]
    this.staffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    this.head.texture = playerTextures.head[heading]
    this.head.position.set(headOffset.x, headOffset.y)
    this.hitStaffBack.texture = playerTextures.staffBack[heading][attachmentPose]
    this.hitRobe.texture = playerTextures.robe[heading][pose]
    this.hitFixed.texture = playerTextures.fixed[heading][attachmentPose]
    this.hitFixed.position.set(fixedOffset.x, fixedOffset.y)
    this.hitStaffFront.texture = playerTextures.staffFront[heading][attachmentPose]
    this.hitStaffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    this.hitHead.texture = playerTextures.head[heading]
    this.hitHead.position.set(headOffset.x, headOffset.y)
    this.orb.container.position.set(
      orbOffset.x + (staffFront ? attachmentOffset.x : 0),
      orbOffset.y + (staffFront ? attachmentOffset.y : 0),
    )
    this.orb.container.zIndex = staffFront ? 6 : 2
    this.orb.update(tick)
  }

  get walkPose(): number {
    return this.currentWalkPose
  }

  get attachmentPose(): number {
    return this.currentAttachmentPose
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.staffBack.tint = tint
    this.robe.tint = tint
    this.fixed.tint = tint
    this.staffFront.tint = tint
    this.head.tint = tint
    this.deathBody.tint = tint
    this.deathAttachment.tint = tint
  }

  get orbSpriteCount(): number {
    return this.orb.sprites.filter((sprite) => sprite.visible).length
  }

  destroy(): void {
    this.container.removeChild(this.orb.container)
    this.orb.destroy()
    this.container.destroy({ children: true })
  }
}

export { PlayerWorldView as HubPlayerView }

export class HubStudentView {
  readonly container = new Container({ label: 'student' })
  private readonly shadow: Sprite
  private readonly body: Sprite
  private readonly props: Sprite[] = []
  private readonly head: Sprite
  private readonly textures: HubWorldTextures
  private cachedHeading = -1
  private cachedPose = -1
  private cachedReading: boolean | undefined
  private cachedScale = Number.NaN
  private readonly cachedPropPalettes: number[] = []

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 0)
    this.shadow.alpha = 0.62
    this.shadow.scale.set(1.1)
    this.body = actorSprite(textures.students.walk[0][0], 1)
    this.head = actorSprite(textures.students.head[0], 3)
    this.head.scale.set(1)
    this.container.addChild(this.shadow, this.body, this.head)
  }

  update(student: ProtocolStudentState): void {
    const heading = spriteFrameIndex(Math.round(student.headingIndex), 24)
    const pose = spriteFrameIndex(student.framePhase, 5)
    const headingChanged = heading !== this.cachedHeading
    const poseChanged = pose !== this.cachedPose
    const readingChanged = student.reading !== this.cachedReading
    const scaleChanged = student.scale !== this.cachedScale
    this.container.visible = true
    this.container.position.set(student.position.x, student.position.y)
    this.container.zIndex = hubWorldDepthForActor(student.position.y)
    if (headingChanged || poseChanged || readingChanged) {
      this.body.texture = (
        student.reading ? this.textures.students.read : this.textures.students.walk
      )[heading][pose]
    }
    if (scaleChanged) this.body.scale.set(student.scale)
    this.syncProps(
      student,
      heading,
      headingChanged,
      readingChanged,
      scaleChanged,
    )
    const headOffset = hubStudentHeadOffset(student)
    if (headingChanged) this.head.texture = this.textures.students.head[heading]
    this.head.position.set(headOffset.x, headOffset.y)
    this.cachedHeading = heading
    this.cachedPose = pose
    this.cachedReading = student.reading
    this.cachedScale = student.scale
  }

  prepareForPool(): void {
    this.container.visible = false
    this.cachedHeading = -1
    this.cachedPose = -1
    this.cachedReading = undefined
    this.cachedScale = Number.NaN
    this.cachedPropPalettes.fill(-1)
    for (const prop of this.props) prop.visible = false
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.props.length = 0
  }

  private syncProps(
    student: ProtocolStudentState,
    heading: number,
    headingChanged: boolean,
    readingChanged: boolean,
    scaleChanged: boolean,
  ): void {
    while (this.props.length < student.props.length) {
      const prop = actorSprite(this.textures.students.props[0][0], 2)
      this.container.addChild(prop)
      this.props.push(prop)
      this.cachedPropPalettes.push(-1)
    }
    for (let index = 0; index < this.props.length; index += 1) {
      const sprite = this.props[index]
      const prop = student.props[index]
      const visible = !student.reading && Boolean(prop)
      if (sprite.visible !== visible) sprite.visible = visible
      if (!prop || !visible) continue
      const palette = spriteFrameIndex(prop.paletteIndex, this.textures.students.props.length)
      const offset = hubStudentPropOffset(student.heading, prop, index)
      const propUninitialized = this.cachedPropPalettes[index] < 0
      if (
        headingChanged
        || readingChanged
        || propUninitialized
        || palette !== this.cachedPropPalettes[index]
      ) {
        sprite.texture = this.textures.students.props[palette][heading]
        this.cachedPropPalettes[index] = palette
      }
      sprite.position.set(offset.x, offset.y)
      if (scaleChanged || readingChanged || propUninitialized) sprite.scale.set(student.scale)
    }
  }
}

export function actorSprite(texture: Texture, zIndex: number): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.zIndex = zIndex
  sprite.eventMode = 'none'
  return sprite
}
