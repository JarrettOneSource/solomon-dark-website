import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import { hub } from '../../lib/assets.ts'
import type { HubMemorialPortrait, HubMemorialSlot } from '../core-kernels/hub-memorial.ts'
import {
  playerCharacterFrontAttachmentOffset,
  playerCharacterHeadOffset,
  playerCharacterRobeFixedPose,
  playerCharacterStaffOrbOffset,
  playerDeathEquipmentAppearance,
} from '../player-character-presentation.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import type { HubWorldTextures } from './hub-textures.ts'

const CAPTURE_SIZE = 64
const CAPTURE_CENTER_Y = -58
const WIZARD_CAPTURE_OFFSET_Y = 20

export class HubMemorialPaintingView {
  readonly container = new Container({ label: 'college-mortuary-dynamic-painting' })
  private readonly easel: Sprite
  private readonly front: Sprite
  private readonly marker: Sprite
  private readonly portraitLayer = new Container({ label: 'memorial-portrait-layer' })
  private readonly textures: HubWorldTextures
  private portraitKey: string | null = null
  private wizard: Container | null = null
  private elementVfx: NativeElementVfxView | null = null

  constructor(textures: HubWorldTextures) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.easel = centeredSprite(textures.base[hub.rooms.mortuary.paintingEasel], 0)
    this.portraitLayer.zIndex = 1
    this.portraitLayer.eventMode = 'none'
    this.front = centeredSprite(textures.base[hub.rooms.mortuary.paintingFront], 2)
    this.marker = centeredSprite(textures.base[hub.rooms.mortuary.paintingMarker], 3)
    this.container.addChild(this.easel, this.portraitLayer, this.front, this.marker)
  }

  update(slot: HubMemorialSlot): void {
    this.marker.visible = slot.marker
    const portrait = slot.portrait
    this.container.visible = portrait !== null
    if (portrait === null) {
      if (this.portraitKey !== null) this.clearPortrait()
      this.portraitKey = null
      return
    }
    const key = `${portrait.runId}\0${portrait.playerId}`
    if (key === this.portraitKey) return
    this.portraitKey = key
    this.replacePortrait(portrait)
  }

  destroy(): void {
    this.clearPortrait()
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }

  private replacePortrait(portrait: HubMemorialPortrait): void {
    this.clearPortrait()
    const capture = new Container({ label: `memorial-capture:${portrait.config.displayName}` })
    capture.position.set(0, CAPTURE_CENTER_Y)
    capture.eventMode = 'none'
    const mask = new Graphics()
      .rect(-CAPTURE_SIZE / 2, -CAPTURE_SIZE / 2, CAPTURE_SIZE, CAPTURE_SIZE)
      .fill(0xffffff)
    const background = centeredSprite(
      this.textures.base[hub.rooms.mortuary.portraitBackground],
      0,
    )
    const wizard = this.createWizard(portrait)
    wizard.position.set(0, WIZARD_CAPTURE_OFFSET_Y)
    wizard.zIndex = 1
    capture.sortableChildren = true
    capture.addChild(mask, background, wizard)
    capture.mask = mask
    this.portraitLayer.addChild(capture)
    this.wizard = capture
  }

  private createWizard(portrait: HubMemorialPortrait): Container {
    const element = portrait.config.element
    const heading = ((Math.round(portrait.headingIndex) % 24) + 24) % 24
    const player = this.textures.players[element]
    const appearance = portrait.equipment
    const robeAppearance = appearance.robe ?? playerDeathEquipmentAppearance(
      element, { hat: null, robe: null, weapon: null },
    ).robe
    const fixedPose = playerCharacterRobeFixedPose(
      0, false, appearance.robe !== null, appearance.weapon?.kind === 'wand' ? 0 : null,
    )
    const wizard = new Container({ label: `memorial-wizard:${portrait.config.displayName}` })
    wizard.sortableChildren = true
    wizard.eventMode = 'none'
    wizard.scale.set(portrait.portraitScale)

    const shadow = actorSprite(this.textures.playerShadow, 0)
    shadow.scale.set(1.25)
    shadow.alpha = 0.72
    const weapon = appearance.weapon === null
      ? null
      : appearance.weapon.kind === 'staff'
        ? this.textures.equipment.staffs[appearance.weapon.selector]
        : this.textures.equipment.wand
    const staffBack = actorSprite(
      weapon?.back[heading]?.[0] ?? player.staffBack[heading]![0]!,
      1,
    )
    const robe = actorSprite(
      this.textures.equipment.robes[robeAppearance.selector]!.primary[heading]![0]!,
      3,
    )
    const robeSecondary = actorSprite(
      this.textures.equipment.robes[robeAppearance.selector]!.secondary[heading]![0]!,
      3,
    )
    const fixed = actorSprite(
      this.textures.equipment.robeFixed.primary[heading]![fixedPose]!,
      4,
    )
    const fixedSecondary = actorSprite(
      this.textures.equipment.robeFixed.secondary[heading]![fixedPose]!,
      4,
    )
    const staffFront = actorSprite(
      weapon?.front[heading]?.[0] ?? player.staffFront[heading]![0]!,
      5,
    )
    staffBack.visible = weapon !== null
    staffFront.visible = weapon !== null
    const head = actorSprite(
      appearance.hat === null
        ? player.head[heading]!
        : this.textures.equipment.hats[appearance.hat.selector]!.primary[heading]!,
      7,
    )
    const headSecondary = actorSprite(
      appearance.hat === null
        ? player.head[heading]!
        : this.textures.equipment.hats[appearance.hat.selector]!.secondary[heading]!,
      7,
    )
    headSecondary.visible = appearance.hat !== null

    robe.tint = robeAppearance.primaryTint
    fixed.tint = robeAppearance.primaryTint
    robeSecondary.tint = robeAppearance.secondaryTint
    fixedSecondary.tint = robeAppearance.secondaryTint
    if (appearance.hat !== null) {
      head.tint = appearance.hat.primaryTint
      headSecondary.tint = appearance.hat.secondaryTint
    }
    const attachmentOffset = playerCharacterFrontAttachmentOffset(0)
    staffFront.position.copyFrom(attachmentOffset)
    const headOffset = playerCharacterHeadOffset(heading, 0)
    head.position.copyFrom(headOffset)
    headSecondary.position.copyFrom(headOffset)

    const elementVfx = new NativeElementVfxView(element, this.textures.elementVfx)
    const orbOffset = playerCharacterStaffOrbOffset(heading)
    elementVfx.container.position.copyFrom(orbOffset)
    elementVfx.container.zIndex = 6
    elementVfx.container.visible = appearance.weapon?.kind === 'staff'
    elementVfx.update(portrait.capturedAtTick, 1)
    this.elementVfx = elementVfx
    wizard.addChild(
      shadow,
      staffBack,
      robe,
      robeSecondary,
      fixed,
      fixedSecondary,
      staffFront,
      elementVfx.container,
      head,
      headSecondary,
    )
    return wizard
  }

  private clearPortrait(): void {
    if (this.elementVfx !== null) {
      this.elementVfx.container.parent?.removeChild(this.elementVfx.container)
      this.elementVfx.destroy()
      this.elementVfx = null
    }
    if (this.wizard !== null) {
      this.portraitLayer.removeChild(this.wizard)
      this.wizard.destroy({ children: true })
      this.wizard = null
    }
  }
}

function centeredSprite(texture: Texture, zIndex: number): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.zIndex = zIndex
  sprite.eventMode = 'none'
  return sprite
}

function actorSprite(texture: Texture, zIndex: number): Sprite {
  return centeredSprite(texture, zIndex)
}
