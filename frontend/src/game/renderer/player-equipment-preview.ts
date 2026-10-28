import { Container, Sprite, type Texture } from 'pixi.js'

import type { HubEquipmentState } from '../core-kernels/hub-economy.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  playerCharacterFrontAttachmentOffset,
  playerCharacterHeadOffset,
  playerCharacterRobeFixedPose,
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
  isPlayerModEquipmentAppearance,
  playerDeathEquipmentAppearance,
  playerLivingEquipmentAppearance,
  type PlayerRenderableEquipmentAppearance,
} from '../player-character-presentation.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { PLAYER_CHARACTER_SHEETS, type PlayerCharacterAtlas } from './player-character-atlas.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'
import { modWearableFrame, type ModPresentationTextures } from './mod-presentation-assets.ts'

export function addPlayerEquipmentPreview(
  layer: Container,
  atlas: PlayerCharacterAtlas,
  elementVfxTextures: PlayerWorldTextures['elementVfx'],
  modTextures: ModPresentationTextures,
  element: WizardElement,
  equipment: Pick<HubEquipmentState, 'hat' | 'robe' | 'weapon'>,
): NativeElementVfxView | null {
  const heading = 9
  const appearance = playerLivingEquipmentAppearance(element, equipment)
  const defaults = playerDeathEquipmentAppearance(element, { hat: null, robe: null, weapon: null })
  const robe = appearance.robe ?? defaults.robe
  const hat = appearance.hat ?? defaults.hat
  const wand = equipment.weapon?.equipmentType === 'wand'
  const fixedPose = playerCharacterRobeFixedPose(0, false, true, wand ? 0 : null)
  const actor = new Container({ label: 'native-inventory-player-preview' })
  actor.position.set(800, 249)
  actor.scale.set(1.25)
  actor.sortableChildren = true
  layer.addChild(actor)

  const addLayer = (texture: Texture, zIndex: number, tint = 0xffffff) => {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.zIndex = zIndex
    sprite.tint = tint
    actor.addChild(sprite)
    return sprite
  }
  const garment = (
    item: NonNullable<PlayerRenderableEquipmentAppearance['robe']>,
    slot: 'hat' | 'robe',
    zIndex: number,
  ): Sprite[] => {
    if (isPlayerModEquipmentAppearance(item)) {
      const textures = modTextures.wearable(item.content)
      if (textures?.slot !== slot) throw new RangeError(`Missing mod ${slot} preview textures`)
      const primary = addLayer(modWearableFrame(textures, 'primary', heading, 0), zIndex, item.primaryTint)
      return textures.secondary === null ? [primary] : [primary,
        addLayer(modWearableFrame(textures, 'secondary', heading, 0), zIndex, item.secondaryTint),
      ]
    }
    const sheets = slot === 'robe'
      ? PLAYER_CHARACTER_SHEETS.robeStyles[item.selector]!
      : PLAYER_CHARACTER_SHEETS.hatStyles[item.selector]!
    return [
      addLayer(atlas.frame(sheets.primary, 0, heading), zIndex, item.primaryTint),
      addLayer(atlas.frame(sheets.secondary, 0, heading), zIndex, item.secondaryTint),
    ]
  }
  let back: Texture | null
  let front: Texture | null
  if (appearance.weapon !== null && isPlayerModEquipmentAppearance(appearance.weapon)) {
    const textures = modTextures.wearable(appearance.weapon.content)
    if (textures?.slot !== 'staff') throw new RangeError('Missing mod staff preview textures')
    const texture = modWearableFrame(textures, 'primary', heading, 0)
    const staffFront = playerCharacterStaffIsFront(heading)
    back = staffFront ? null : texture
    front = staffFront ? texture : null
  } else {
    const sheets = appearance.weapon === null
      ? PLAYER_CHARACTER_SHEETS.bareAttachment
      : wand ? PLAYER_CHARACTER_SHEETS.wand : PLAYER_CHARACTER_SHEETS.staffStyles[appearance.weapon.selector]!
    back = atlas.frame(sheets.back, 0, heading)
    front = atlas.frame(sheets.front, 0, heading)
  }
  if (back) addLayer(back, 1)
  const robeLayers = garment(robe, 'robe', 3)
  addLayer(atlas.frame(PLAYER_CHARACTER_SHEETS.robeFixedLayers.primary, fixedPose, heading), 4, robe.primaryTint)
  if (robeLayers.length === 2) {
    addLayer(atlas.frame(PLAYER_CHARACTER_SHEETS.robeFixedLayers.secondary, fixedPose, heading), 4, robe.secondaryTint)
  }
  if (front) addLayer(front, 5).position.copyFrom(playerCharacterFrontAttachmentOffset(0))
  const headOffset = playerCharacterHeadOffset(heading, 0)
  for (const sprite of garment(hat, 'hat', 7)) sprite.position.copyFrom(headOffset)

  if (equipment.weapon?.equipmentType !== 'staff') return null
  const vfx = new NativeElementVfxView(element, elementVfxTextures)
  vfx.container.position.copyFrom(playerCharacterStaffOrbOffset(heading))
  vfx.container.zIndex = 6
  actor.addChild(vfx.container)
  vfx.update(0, 1)
  return vfx
}
