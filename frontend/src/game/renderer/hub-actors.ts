import { Container, Sprite, type Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from '../hub-presentation.ts'
import type {
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import { createPlayerCharacterDrawPlan } from '../player-character-presentation.ts'
import { HubElementVfx } from './hub-element-vfx.ts'
import { hubWorldDepthForActor, spriteFrameIndex } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export class PlayerWorldView {
  readonly container = new Container({ label: 'local-player' })
  private readonly shadow: Sprite
  private readonly staffBack: Sprite
  private readonly orb: HubElementVfx
  private readonly robe: Sprite
  private readonly fixed: Sprite
  private readonly staffFront: Sprite
  private readonly head: Sprite
  private readonly textures: PlayerWorldTextures
  private currentWalkPose = 0

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
    this.staffBack = actorSprite(playerTextures.staffBack[0], 1)
    this.orb = new HubElementVfx(element, textures.elementVfx)
    this.orb.container.zIndex = 2
    this.robe = actorSprite(playerTextures.robe[0][0], 3)
    this.fixed = actorSprite(playerTextures.fixed[0], 4)
    this.staffFront = actorSprite(playerTextures.staffFront[0], 5)
    this.head = actorSprite(playerTextures.head[0], 7)
    this.container.addChild(
      this.shadow,
      this.staffBack,
      this.orb.container,
      this.robe,
      this.fixed,
      this.staffFront,
      this.head,
    )
  }

  update(player: ProtocolPlayerState, tick: number): void {
    const playerTextures = this.textures.players[player.config.element]
    const plan = createPlayerCharacterDrawPlan(player)
    const heading = spriteFrameIndex(Math.round(player.headingIndex), 24)
    const pose = spriteFrameIndex(plan.robePose, 5)
    this.currentWalkPose = pose
    const fixedOffset = plan.fixedRobeOffset
    const attachmentOffset = plan.frontAttachmentOffset
    const headOffset = plan.headOffset
    const orbOffset = plan.orbOffset
    const staffFront = plan.staffFront

    this.container.position.set(player.position.x, player.position.y)
    this.container.zIndex = hubWorldDepthForActor(player.position.y)
    this.staffBack.texture = playerTextures.staffBack[heading]
    this.staffBack.visible = !staffFront
    this.robe.texture = playerTextures.robe[heading][pose]
    this.fixed.texture = playerTextures.fixed[heading]
    this.fixed.position.set(fixedOffset.x, fixedOffset.y)
    this.staffFront.texture = playerTextures.staffFront[heading]
    this.staffFront.visible = staffFront
    this.staffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    this.head.texture = playerTextures.head[heading]
    this.head.position.set(headOffset.x, headOffset.y)
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

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.staffBack.tint = tint
    this.robe.tint = tint
    this.fixed.tint = tint
    this.staffFront.tint = tint
    this.head.tint = tint
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

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.shadow = actorSprite(textures.base[hub.npcs.teacher.shadow], 0)
    this.shadow.alpha = 0.62
    this.shadow.scale.set(1.1)
    this.body = actorSprite(textures.students.walk[0][0], 1)
    this.head = actorSprite(textures.students.head[0], 3)
    this.container.addChild(this.shadow, this.body, this.head)
  }

  update(student: ProtocolStudentState): void {
    const heading = spriteFrameIndex(Math.round(student.headingIndex), 24)
    const pose = spriteFrameIndex(student.framePhase, 5)
    this.container.position.set(student.position.x, student.position.y)
    this.container.zIndex = hubWorldDepthForActor(student.position.y)
    this.body.texture = (student.reading ? this.textures.students.read : this.textures.students.walk)[heading][pose]
    this.body.scale.set(student.scale)
    this.body.visible = true
    this.syncProps(student, heading)
    const headOffset = hubStudentHeadOffset(student)
    this.head.texture = this.textures.students.head[heading]
    this.head.position.set(headOffset.x, headOffset.y)
    this.head.scale.set(1)
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.props.length = 0
  }

  private syncProps(student: ProtocolStudentState, heading: number): void {
    while (this.props.length < student.props.length) {
      const prop = actorSprite(this.textures.students.props[0][0], 2)
      this.container.addChild(prop)
      this.props.push(prop)
    }
    for (let index = 0; index < this.props.length; index += 1) {
      const sprite = this.props[index]
      const prop = student.props[index]
      sprite.visible = !student.reading && Boolean(prop)
      if (!prop || student.reading) continue
      const palette = spriteFrameIndex(prop.paletteIndex, this.textures.students.props.length)
      const offset = hubStudentPropOffset(student.heading, prop, index)
      sprite.texture = this.textures.students.props[palette][heading]
      sprite.position.set(offset.x, offset.y)
      sprite.scale.set(student.scale)
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
