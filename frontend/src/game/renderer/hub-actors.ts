import { Container, Sprite, type Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import type { PlayerStaffAttachmentPose } from '../core-kernels/primary-spells.ts'
import { playerHitOverlayAlpha } from '../core-kernels/player-combat.ts'
import type { NativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
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
  playerEquippedElementEffectScale,
  playerDeathEquipmentAppearance,
  playerLivingEquipmentAppearance,
} from '../player-character-presentation.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { hubWorldDepthForActor, spriteFrameIndex } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import {
  playerDeathHatAnchor,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import { nativeSecondarySpriteKey, nativeSecondarySpriteRecord } from './native-secondary-assets.ts'
import {
  nativePlayerMagicShieldPlan,
  nativePlayerMaterialTint,
} from './native-secondary-presentation.ts'

const DEATH_HAT_PRIMARY = 7
const DEATH_HAT_SECONDARY = 8
const PLAYER_DEATH_LAYER_COUNT = 9

export class PlayerWorldView {
  readonly container = new Container({ label: 'local-player' })
  private readonly shadow: Sprite
  private readonly staffBack: Sprite
  private readonly orbFrontBase: NativeElementVfxView
  private readonly orbFrontOverlay: NativeElementVfxView
  private readonly robe: Sprite
  private readonly robeSecondary: Sprite
  private readonly fixed: Sprite
  private readonly fixedSecondary: Sprite
  private readonly staffFront: Sprite
  private readonly head: Sprite
  private readonly headSecondary: Sprite
  private readonly hitOverlay: Container
  private readonly hitStaffBack: Sprite
  private readonly hitRobe: Sprite
  private readonly hitRobeSecondary: Sprite
  private readonly hitFixed: Sprite
  private readonly hitFixedSecondary: Sprite
  private readonly hitStaffFront: Sprite
  private readonly hitHead: Sprite
  private readonly hitHeadSecondary: Sprite
  private readonly deathLayers: readonly Sprite[]
  private readonly deathShadowLayers: readonly Sprite[]
  private readonly magicShield: Sprite
  private readonly textures: PlayerWorldTextures
  private readonly deathBaseTints = Array.from(
    { length: PLAYER_DEATH_LAYER_COUNT },
    () => 0xffffff,
  )
  private worldTint = 0xffffff
  private currentWalkPose = 0
  private currentAttachmentPose = 0
  private currentElementEffectScale = 1
  private currentDeathFrame: number | null = null
  private secondaryState: NativeSecondaryPlayerState | undefined
  private robePrimaryTint = 0xffffff
  private robeSecondaryTint = 0xffffff
  private headPrimaryTint = 0xffffff
  private headSecondaryTint = 0xffffff

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
    this.robe = actorSprite(playerTextures.robe[0][0], 3)
    this.robeSecondary = actorSprite(playerTextures.robe[0][0], 3)
    this.fixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.fixedSecondary = actorSprite(playerTextures.fixed[0][0], 4)
    this.staffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.orbFrontBase = new NativeElementVfxView(element, textures.elementVfx)
    this.orbFrontBase.container.label = 'native-element-vfx-front-base'
    this.orbFrontBase.container.zIndex = 6
    this.orbFrontOverlay = new NativeElementVfxView(element, textures.elementVfx)
    this.orbFrontOverlay.container.label = 'native-element-vfx-front-overlay'
    this.orbFrontOverlay.container.zIndex = 6
    this.head = actorSprite(playerTextures.head[0], 7)
    this.headSecondary = actorSprite(playerTextures.head[0], 7)
    this.deathShadowLayers = createDeathLayers(playerTextures.death[0][0], 1, 'shadow')
    this.deathLayers = createDeathLayers(playerTextures.death[0][0], 11, 'color')
    this.hitOverlay = new Container({ label: 'player-hit-overlay' })
    this.hitOverlay.sortableChildren = true
    this.hitOverlay.eventMode = 'none'
    this.hitOverlay.zIndex = 8
    this.hitStaffBack = actorSprite(playerTextures.staffBack[0][0], 1)
    this.hitRobe = actorSprite(playerTextures.robe[0][0], 3)
    this.hitRobeSecondary = actorSprite(playerTextures.robe[0][0], 3)
    this.hitFixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.hitFixedSecondary = actorSprite(playerTextures.fixed[0][0], 4)
    this.hitStaffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.hitHead = actorSprite(playerTextures.head[0], 7)
    this.hitHeadSecondary = actorSprite(playerTextures.head[0], 7)
    for (const sprite of [
      this.hitStaffBack,
      this.hitRobe,
      this.hitRobeSecondary,
      this.hitFixed,
      this.hitFixedSecondary,
      this.hitStaffFront,
      this.hitHead,
      this.hitHeadSecondary,
    ]) sprite.tint = 0xff0000
    this.hitOverlay.addChild(
      this.hitStaffBack,
      this.hitRobe,
      this.hitRobeSecondary,
      this.hitFixed,
      this.hitFixedSecondary,
      this.hitStaffFront,
      this.hitHead,
      this.hitHeadSecondary,
    )
    const shieldRecord = nativeSecondarySpriteRecord('BadGuys', 49)
    this.magicShield = new Sprite(textures.secondary[nativeSecondarySpriteKey('BadGuys', 49)])
    this.magicShield.anchor.set(
      shieldRecord.anchorX / shieldRecord.width,
      shieldRecord.anchorY / shieldRecord.height,
    )
    this.magicShield.position.set(0, -30)
    this.magicShield.zIndex = 8
    this.magicShield.blendMode = 'add'
    this.magicShield.eventMode = 'none'
    this.magicShield.visible = false
    this.container.addChild(
      this.shadow,
      this.staffBack,
      this.robe,
      this.robeSecondary,
      this.fixed,
      this.fixedSecondary,
      this.staffFront,
      this.orbFrontBase.container,
      this.orbFrontOverlay.container,
      this.head,
      this.headSecondary,
      ...this.deathShadowLayers,
      ...this.deathLayers,
      this.hitOverlay,
      this.magicShield,
    )
  }

  update(
    player: ProtocolPlayerState,
    tick: number,
    staffActionPose: PlayerStaffAttachmentPose | null = null,
  ): void {
    const playerTextures = this.textures.players[player.config.element]
    const elementEffectPhase = player.lighting.overlayEffectPhase
    const plan = createPlayerCharacterDrawPlan(
      player,
      1,
      staffActionPose,
      (this.secondaryState?.staffCastTicksRemaining ?? 0) > 0
        || (this.secondaryState?.castSpinTicksRemaining ?? 0) > 0,
      elementEffectPhase,
    )
    const heading = spriteFrameIndex(Math.round(player.headingIndex), 24)
    const pose = spriteFrameIndex(plan.robePose, 5)
    const attachmentPose = plan.attachmentPose
    this.currentAttachmentPose = attachmentPose
    this.currentWalkPose = pose
    const fixedOffset = plan.fixedRobeOffset
    const attachmentOffset = plan.frontAttachmentOffset
    const headOffset = plan.headOffset
    const orbOffset = plan.orbOffset
    const death = createPlayerDeathDrawPlan(
      player.headingIndex,
      player.progression.lifeState,
      player.progression.deathTick,
    )
    const deathAppearance = playerDeathEquipmentAppearance(
      player.config.element,
      player.economy.equipment,
    )
    const livingAppearance = playerLivingEquipmentAppearance(
      player.config.element,
      player.economy.equipment,
    )
    const weaponTextures = livingAppearance.weapon === null
      ? null
      : livingAppearance.weapon.kind === 'staff'
        ? this.textures.equipment.staffs[livingAppearance.weapon.selector]
        : this.textures.equipment.wand
    if (livingAppearance.weapon !== null && weaponTextures === undefined) {
      throw new RangeError(
        `Missing native ${livingAppearance.weapon.kind} selector ${livingAppearance.weapon.selector}`,
      )
    }
    const hasWeapon = weaponTextures !== null
    const hasStaff = livingAppearance.weapon?.kind === 'staff'
    this.currentDeathFrame = death.visible ? death.frame : null

    this.container.position.set(player.position.x, player.position.y)
    this.container.zIndex = hubWorldDepthForActor(player.position.y)
    this.shadow.visible = !death.visible
    // The extracted native item banks already partition each pose into an
    // all-transparent back or front cell from Clothes point-0 depth. Keeping
    // both passes live preserves every melee pose without duplicating pixels.
    this.staffBack.visible = !death.visible && hasWeapon
    this.orbFrontBase.container.visible = !death.visible
      && hasStaff
      && plan.orbPasses.frontBase
    this.orbFrontOverlay.container.visible = !death.visible
      && hasStaff
      && plan.orbPasses.frontOverlay
    this.robe.visible = !death.visible
    this.robeSecondary.visible = !death.visible && livingAppearance.robe !== null
    this.fixed.visible = !death.visible
    this.fixedSecondary.visible = !death.visible && livingAppearance.robe !== null
    this.staffFront.visible = !death.visible && hasWeapon
    this.head.visible = !death.visible
    this.headSecondary.visible = !death.visible && livingAppearance.hat !== null
    this.updateDeathLayers(playerTextures, death, deathAppearance)
    const hitAlpha = playerHitOverlayAlpha(player.progression, tick)
    this.hitOverlay.alpha = hitAlpha
    this.hitOverlay.visible = !death.visible && hitAlpha > 0
    this.hitStaffBack.visible = hasWeapon
    this.hitRobe.visible = true
    this.hitRobeSecondary.visible = livingAppearance.robe !== null
    this.hitFixed.visible = true
    this.hitFixedSecondary.visible = livingAppearance.robe !== null
    this.hitStaffFront.visible = hasWeapon
    this.hitHead.visible = true
    this.hitHeadSecondary.visible = livingAppearance.hat !== null
    if (weaponTextures !== null) {
      this.staffBack.texture = weaponTextures.back[heading]![attachmentPose]!
      this.staffFront.texture = weaponTextures.front[heading]![attachmentPose]!
      this.hitStaffBack.texture = weaponTextures.back[heading]![attachmentPose]!
      this.hitStaffFront.texture = weaponTextures.front[heading]![attachmentPose]!
    }
    if (livingAppearance.robe === null) {
      this.robe.texture = playerTextures.robe[heading]![pose]!
      this.fixed.texture = playerTextures.fixed[heading]![attachmentPose]!
      this.robePrimaryTint = 0xffffff
      this.robeSecondaryTint = 0xffffff
    } else {
      const robeTextures = this.textures.equipment.robes[livingAppearance.robe.selector]
      if (robeTextures === undefined) {
        throw new RangeError(`Missing native robe selector ${livingAppearance.robe.selector}`)
      }
      this.robe.texture = robeTextures.primary[heading]![pose]!
      this.robeSecondary.texture = robeTextures.secondary[heading]![pose]!
      this.fixed.texture = this.textures.equipment.robeFixed.primary[heading]![attachmentPose]!
      this.fixedSecondary.texture = this.textures.equipment.robeFixed.secondary[heading]![attachmentPose]!
      this.robePrimaryTint = livingAppearance.robe.primaryTint
      this.robeSecondaryTint = livingAppearance.robe.secondaryTint
    }
    this.fixed.position.set(fixedOffset.x, fixedOffset.y)
    this.fixedSecondary.position.set(fixedOffset.x, fixedOffset.y)
    this.staffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    if (livingAppearance.hat === null) {
      this.head.texture = playerTextures.head[heading]!
      this.headPrimaryTint = 0xffffff
      this.headSecondaryTint = 0xffffff
    } else {
      const hatTextures = this.textures.equipment.hats[livingAppearance.hat.selector]
      if (hatTextures === undefined) {
        throw new RangeError(`Missing native hat selector ${livingAppearance.hat.selector}`)
      }
      this.head.texture = hatTextures.primary[heading]!
      this.headSecondary.texture = hatTextures.secondary[heading]!
      this.headPrimaryTint = livingAppearance.hat.primaryTint
      this.headSecondaryTint = livingAppearance.hat.secondaryTint
    }
    this.head.position.set(headOffset.x, headOffset.y)
    this.headSecondary.position.set(headOffset.x, headOffset.y)
    this.hitRobe.texture = this.robe.texture
    this.hitRobeSecondary.texture = this.robeSecondary.texture
    this.hitFixed.texture = this.fixed.texture
    this.hitFixedSecondary.texture = this.fixedSecondary.texture
    this.hitFixed.position.set(fixedOffset.x, fixedOffset.y)
    this.hitFixedSecondary.position.set(fixedOffset.x, fixedOffset.y)
    this.hitStaffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    this.hitHead.texture = this.head.texture
    this.hitHeadSecondary.texture = this.headSecondary.texture
    this.hitHead.position.set(headOffset.x, headOffset.y)
    this.hitHeadSecondary.position.set(headOffset.x, headOffset.y)
    for (const orb of [this.orbFrontBase, this.orbFrontOverlay]) {
      orb.container.position.set(
        orbOffset.x + attachmentOffset.x,
        orbOffset.y + attachmentOffset.y,
      )
    }
    this.currentElementEffectScale = playerEquippedElementEffectScale(
      player.lighting.overlayEffectPhase,
    )
    this.orbFrontBase.update(tick, this.currentElementEffectScale)
    this.orbFrontOverlay.update(tick, this.currentElementEffectScale)
    this.applyMaterialTint()
  }

  get walkPose(): number {
    return this.currentWalkPose
  }

  get attachmentPose(): number {
    return this.currentAttachmentPose
  }

  get elementEffectScale(): number {
    return this.currentElementEffectScale
  }

  get deathColorLayerCount(): number {
    return this.deathLayers.filter((layer) => layer.visible).length
  }

  get deathFrame(): number | null {
    return this.currentDeathFrame
  }

  get deathShadowLayerCount(): number {
    return this.deathShadowLayers.filter((layer) => layer.visible).length
  }

  get materialTint(): number {
    return this.robe.tint
  }

  get weaponScale(): number {
    return this.staffBack.scale.x
  }

  get magicShieldScale(): number {
    return this.magicShield.scale.x
  }

  get magicShieldVisible(): boolean {
    return this.magicShield.visible
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setSecondaryState(
    state: NativeSecondaryPlayerState | undefined,
    tick: number,
  ): void {
    this.secondaryState = state
    const plan = nativePlayerMagicShieldPlan(state, tick)
    this.magicShield.visible = plan.visible
    this.magicShield.tint = plan.tint
    this.magicShield.scale.set(plan.scale)
    this.applyMaterialTint()
  }

  setWorldTint(tint: number): void {
    this.worldTint = tint
    this.applyMaterialTint()
  }

  private applyMaterialTint(): void {
    const tint = nativePlayerMaterialTint(this.worldTint, this.secondaryState)
    this.staffBack.tint = tint
    this.robe.tint = multiplyTints(this.robePrimaryTint, tint)
    this.robeSecondary.tint = multiplyTints(this.robeSecondaryTint, tint)
    this.fixed.tint = multiplyTints(this.robePrimaryTint, tint)
    this.fixedSecondary.tint = multiplyTints(this.robeSecondaryTint, tint)
    this.staffFront.tint = tint
    this.head.tint = multiplyTints(this.headPrimaryTint, tint)
    this.headSecondary.tint = multiplyTints(this.headSecondaryTint, tint)
    this.applyDeathTints()
  }

  get orbSpriteCount(): number {
    return [this.orbFrontBase, this.orbFrontOverlay]
      .filter(({ container }) => container.visible)
      .reduce((count, orb) => (
        count + orb.sprites.filter((sprite) => sprite.visible).length
      ), 0)
  }

  destroy(): void {
    for (const orb of [this.orbFrontBase, this.orbFrontOverlay]) {
      this.container.removeChild(orb.container)
      orb.destroy()
    }
    this.container.destroy({ children: true })
  }

  private updateDeathLayers(
    playerTextures: PlayerWorldTextures['players'][WizardElement],
    death: ReturnType<typeof createPlayerDeathDrawPlan>,
    appearance: ReturnType<typeof playerDeathEquipmentAppearance>,
  ): void {
    const { facing, frame, heading } = death
    const robe = this.textures.death.robe
    const hat = this.textures.death.hat
    const selectedTextures = [
      robe.primary[appearance.robe.selector]![facing]![frame]!,
      robe.secondary[appearance.robe.selector]![facing]![frame]!,
      robe.fixedPrimary[0]![facing]![frame]!,
      robe.fixedPrimary[1]![facing]![frame]!,
      robe.fixedSecondary[0]![facing]![frame]!,
      robe.fixedSecondary[1]![facing]![frame]!,
      playerTextures.death[facing]![frame]!,
      appearance.hat.selector === 3 && frame === 3
        ? hat.specialPrimary[facing]!
        : hat.primary[appearance.hat.selector]![heading]!,
      appearance.hat.selector === 3 && frame === 3
        ? hat.specialSecondary[facing]!
        : hat.secondary[appearance.hat.selector]![heading]!,
    ]
    const baseTints = [
      appearance.robe.primaryTint,
      appearance.robe.secondaryTint,
      appearance.robe.primaryTint,
      appearance.robe.primaryTint,
      appearance.robe.secondaryTint,
      appearance.robe.secondaryTint,
      0xffffff,
      appearance.hat.primaryTint,
      appearance.hat.secondaryTint,
    ]
    const hatOffset = appearance.hat.selector === 3 && frame === 3
      ? { x: 0, y: 0 }
      : playerDeathHatAnchor(frame, facing)
    for (let index = 0; index < PLAYER_DEATH_LAYER_COUNT; index += 1) {
      const layer = this.deathLayers[index]!
      const shadow = this.deathShadowLayers[index]!
      layer.visible = death.visible
      shadow.visible = death.shadow
      layer.texture = selectedTextures[index]!
      shadow.texture = selectedTextures[index]!
      this.deathBaseTints[index] = baseTints[index]!
      const isHat = index === DEATH_HAT_PRIMARY || index === DEATH_HAT_SECONDARY
      const x = isHat ? hatOffset.x : 0
      const y = isHat ? hatOffset.y : 0
      layer.position.set(x, y)
      shadow.position.set(x, y + 4)
    }
    this.applyDeathTints()
  }

  private applyDeathTints(): void {
    const tint = nativePlayerMaterialTint(this.worldTint, this.secondaryState)
    for (let index = 0; index < PLAYER_DEATH_LAYER_COUNT; index += 1) {
      this.deathLayers[index]!.tint = multiplyTints(
        this.deathBaseTints[index]!,
        tint,
      )
      this.deathShadowLayers[index]!.tint = 0x000000
    }
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

function createDeathLayers(
  texture: Texture,
  firstZIndex: number,
  pass: 'color' | 'shadow',
): readonly Sprite[] {
  const names = [
    'robe-primary',
    'robe-secondary',
    'robe-fixed-primary-a',
    'robe-fixed-primary-b',
    'robe-fixed-secondary-a',
    'robe-fixed-secondary-b',
    'body',
    'hat-primary',
    'hat-secondary',
  ]
  return names.map((name, index) => {
    const sprite = actorSprite(texture, firstZIndex + index)
    sprite.label = `player-death:${pass}:${name}`
    sprite.visible = false
    return sprite
  })
}

function multiplyTints(first: number, second: number): number {
  const channel = (shift: number): number => Math.round(
    ((first >> shift) & 0xff) * ((second >> shift) & 0xff) / 255,
  )
  return channel(16) << 16 | channel(8) << 8 | channel(0)
}
