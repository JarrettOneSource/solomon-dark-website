import { hub } from '../../lib/assets.ts'
import { hubStudentHeadOffset, hubStudentPropOffset } from '../hub-presentation.ts'
import type { ProtocolStudentState } from '../protocol/game-state.ts'
import { hubWorldDepthForActor, spriteFrameIndex } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import { Container, Sprite, type Texture } from 'pixi.js'

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
