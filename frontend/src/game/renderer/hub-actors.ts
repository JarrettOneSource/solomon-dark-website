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
  NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE,
  createPlayerCharacterDrawPlan,
  createPlayerDeathDrawPlan,
  isPlayerModEquipmentAppearance,
  playerEquippedElementEffectScale,
  playerDeathEquipmentAppearance,
  playerLivingEquipmentAppearance,
  playerCharacterRobeFixedPose,
  playerCharacterStaffIsFront,
} from '../player-character-presentation.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { PlayerDamageX4VfxView } from './player-damage-x4-vfx-view.ts'
import { PlayerEnchantStaffView } from './player-enchant-staff-view.ts'
import { hubWorldDepthForActor, spriteFrameIndex } from './hub-render-contract.ts'
import type { HubWorldTextures } from './hub-textures.ts'
import {
  playerDeathHatAnchor,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import { nativeSecondarySpriteKey, nativeSecondarySpriteRecord } from './native-secondary-assets.ts'
import {
  nativePlayerMagicShieldPlan,
  NATIVE_PLAYER_MAGIC_SHIELD,
  nativePlayerMaterialTint,
} from './native-secondary-presentation.ts'
import type { ModPresentationTextures, ModWearableTextureFrames } from './mod-presentation-assets.ts'
import {
  advanceActorMovementFacing,
  createActorMovementFacingState,
  type ActorMovementFacingState,
} from '../core-kernels/actor-heading.ts'

const DEATH_HAT_PRIMARY = 7
const DEATH_HAT_SECONDARY = 8
const PLAYER_DEATH_LAYER_COUNT = 9

export class PlayerWorldView {
  readonly container = new Container({ label: 'local-player' })
  private readonly shadow: Sprite
  private readonly staffBack: Sprite
  private readonly damageX4FrontBase: PlayerDamageX4VfxView
  private readonly damageX4FrontOverlay: PlayerDamageX4VfxView
  private readonly orbFrontBase: NativeElementVfxView
  private readonly orbFrontOverlay: NativeElementVfxView
  private readonly robe: Sprite
  private readonly robeSecondary: Sprite
  private readonly unselectedRobeAttachment: Sprite
  private readonly fixed: Sprite
  private readonly fixedSecondary: Sprite
  private readonly staffFront: Sprite
  private readonly enchantStaff: PlayerEnchantStaffView
  private readonly head: Sprite
  private readonly headSecondary: Sprite
  private readonly hitOverlay: Container
  private readonly hitStaffBack: Sprite
  private readonly hitRobe: Sprite
  private readonly hitRobeSecondary: Sprite
  private readonly hitUnselectedRobeAttachment: Sprite
  private readonly hitFixed: Sprite
  private readonly hitFixedSecondary: Sprite
  private readonly hitStaffFront: Sprite
  private readonly hitHead: Sprite
  private readonly hitHeadSecondary: Sprite
  private readonly deathLayers: readonly Sprite[]
  private readonly deathShadowLayers: readonly Sprite[]
  private readonly magicShield: Sprite
  private readonly modTextures: ModPresentationTextures
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
  private currentHeadingIndex = 0
  private currentOrdinaryWeaponVisible = false
  private currentRobeFixedPose = 0
  private currentUnselectedPrimaryAttachment = false
  private movementFacingState: ActorMovementFacingState | null = null
  private secondaryState: NativeSecondaryPlayerState | undefined
  private robePrimaryTint = 0xffffff
  private robeSecondaryTint = 0xffffff
  private headPrimaryTint = 0xffffff
  private headSecondaryTint = 0xffffff

  constructor(
    element: WizardElement,
    textures: PlayerWorldTextures,
    modTextures: ModPresentationTextures,
  ) {
    this.textures = textures
    this.modTextures = modTextures
    const playerTextures = textures.players[element]
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.shadow = actorSprite(textures.playerShadow, 0)
    this.shadow.scale.set(1.25)
    this.shadow.alpha = 0.72
    this.staffBack = actorSprite(playerTextures.staffBack[0][0], 1)
    this.robe = actorSprite(playerTextures.robe[0][0], 3)
    this.robeSecondary = actorSprite(playerTextures.robe[0][0], 3)
    this.unselectedRobeAttachment = actorSprite(
      textures.equipment.unselectedAttachment.robe[0],
      3.5,
    )
    this.fixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.fixedSecondary = actorSprite(playerTextures.fixed[0][0], 4)
    this.staffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.enchantStaff = new PlayerEnchantStaffView(textures.enchantStaff)
    const damageX4Texture = textures.secondary[nativeSecondarySpriteKey('BadGuys', 7)]
    this.damageX4FrontBase = new PlayerDamageX4VfxView(damageX4Texture)
    this.damageX4FrontBase.container.label = 'player-damage-x4-vfx-front-base'
    this.damageX4FrontBase.container.zIndex = 6
    this.damageX4FrontOverlay = new PlayerDamageX4VfxView(damageX4Texture)
    this.damageX4FrontOverlay.container.label = 'player-damage-x4-vfx-front-overlay'
    this.damageX4FrontOverlay.container.zIndex = 6
    this.orbFrontBase = new NativeElementVfxView(null, textures.elementVfx)
    this.orbFrontBase.container.label = 'native-element-vfx-front-base'
    this.orbFrontBase.container.zIndex = 6
    this.orbFrontOverlay = new NativeElementVfxView(null, textures.elementVfx)
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
    this.hitUnselectedRobeAttachment = actorSprite(
      textures.equipment.unselectedAttachment.robe[0],
      3.5,
    )
    this.hitFixed = actorSprite(playerTextures.fixed[0][0], 4)
    this.hitFixedSecondary = actorSprite(playerTextures.fixed[0][0], 4)
    this.hitStaffFront = actorSprite(playerTextures.staffFront[0][0], 5)
    this.hitHead = actorSprite(playerTextures.head[0], 7)
    this.hitHeadSecondary = actorSprite(playerTextures.head[0], 7)
    for (const sprite of [
      this.hitStaffBack,
      this.hitRobe,
      this.hitRobeSecondary,
      this.hitUnselectedRobeAttachment,
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
      this.hitUnselectedRobeAttachment,
      this.hitFixed,
      this.hitFixedSecondary,
      this.hitStaffFront,
      this.hitHead,
      this.hitHeadSecondary,
    )
    const shield = NATIVE_PLAYER_MAGIC_SHIELD
    const shieldRecord = nativeSecondarySpriteRecord(shield.atlas, shield.entry)
    this.magicShield = new Sprite(textures.secondary[nativeSecondarySpriteKey(shield.atlas, shield.entry)])
    this.magicShield.anchor.set(
      shieldRecord.anchorX / shieldRecord.width,
      shieldRecord.anchorY / shieldRecord.height,
    )
    this.magicShield.position.set(0, shield.offsetY)
    this.magicShield.zIndex = 8
    this.magicShield.blendMode = 'add'
    this.magicShield.eventMode = 'none'
    this.magicShield.visible = false
    this.container.addChild(
      this.shadow,
      this.staffBack,
      this.enchantStaff.container,
      this.robe,
      this.robeSecondary,
      this.unselectedRobeAttachment,
      this.fixed,
      this.fixedSecondary,
      this.staffFront,
      this.damageX4FrontBase.container,
      this.orbFrontBase.container,
      this.damageX4FrontOverlay.container,
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
    elementEffectVisible = true,
    movementFacing = false,
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
    const heading = spriteFrameIndex(
      Math.round(this.resolveHeadingIndex(player, movementFacing)),
      24,
    )
    this.currentHeadingIndex = heading
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
    const modWeapon = livingAppearance.weapon !== null
      && isPlayerModEquipmentAppearance(livingAppearance.weapon)
    const modWeaponTextures = modWeapon
      ? this.modTextures.wearable(livingAppearance.weapon.content)
      : null
    const weaponTextures = livingAppearance.weapon === null || modWeapon
      ? null
      : livingAppearance.weapon.kind === 'staff'
        ? this.textures.equipment.staffs[livingAppearance.weapon.selector]
        : this.textures.equipment.wand
    if (
      livingAppearance.weapon !== null
      && !isPlayerModEquipmentAppearance(livingAppearance.weapon)
      && weaponTextures === undefined
    ) {
      throw new RangeError(
        `Missing native ${livingAppearance.weapon.kind} selector ${livingAppearance.weapon.selector}`,
      )
    }
    if (modWeapon && modWeaponTextures?.slot !== 'staff') {
      throw new RangeError('Missing mod staff wearable textures')
    }
    const modRobeTextures = livingAppearance.robe !== null
      && isPlayerModEquipmentAppearance(livingAppearance.robe)
      ? this.modTextures.wearable(livingAppearance.robe.content)
      : null
    if (modRobeTextures && modRobeTextures.slot !== 'robe') {
      throw new RangeError('Missing mod robe wearable textures')
    }
    const modHatTextures = livingAppearance.hat !== null
      && isPlayerModEquipmentAppearance(livingAppearance.hat)
      ? this.modTextures.wearable(livingAppearance.hat.content)
      : null
    if (modHatTextures && modHatTextures.slot !== 'hat') {
      throw new RangeError('Missing mod hat wearable textures')
    }
    const hasWeapon = weaponTextures !== null || modWeaponTextures !== null
    const hasStaff = livingAppearance.weapon?.kind === 'staff'
    const nativeRobe = livingAppearance.robe !== null
      && !isPlayerModEquipmentAppearance(livingAppearance.robe)
    const bareAttachmentVisible = !plan.unselectedPrimaryAttachment
      && !hasWeapon
      && plan.bareAttachmentPose !== null
    const fallbackAttachmentVisible = plan.unselectedPrimaryAttachment
      || bareAttachmentVisible
    const ordinaryWeaponVisible = !plan.unselectedPrimaryAttachment && hasWeapon
    const ordinaryStaffVisible = !plan.unselectedPrimaryAttachment && hasStaff
    const nativeStaffVisible = ordinaryStaffVisible && !modWeapon
    const unselectedRobeAttachmentVisible = plan.unselectedPrimaryAttachment
      && nativeRobe
    const robeFixedPose = playerCharacterRobeFixedPose(
      attachmentPose,
      plan.unselectedPrimaryAttachment,
      nativeRobe,
    )
    const selectedPrimaryAvailable = (this.secondaryState?.planewalkerTicksRemaining ?? 0) > 0
      || player.primaryCast.selectedPrimaryId >= 0
    const modStaffFront = modWeaponTextures
      ? playerCharacterStaffIsFront(heading, attachmentPose)
      : null
    const robeHasSecondary = livingAppearance.robe !== null
      && (modRobeTextures ? modRobeTextures.secondary !== null : true)
    const hatHasSecondary = livingAppearance.hat !== null
      && (modHatTextures ? modHatTextures.secondary !== null : true)
    this.currentDeathFrame = death.visible ? death.frame : null
    this.currentOrdinaryWeaponVisible = ordinaryWeaponVisible
    this.currentRobeFixedPose = robeFixedPose
    this.currentUnselectedPrimaryAttachment = plan.unselectedPrimaryAttachment

    this.container.position.set(player.position.x, player.position.y)
    this.container.zIndex = hubWorldDepthForActor(player.position.y)
    this.shadow.visible = !death.visible
    // The extracted native item banks already partition each pose into an
    // all-transparent back or front cell from Clothes point-0 depth. Keeping
    // both passes live preserves every melee pose without duplicating pixels.
    this.staffBack.visible = !death.visible && (
      fallbackAttachmentVisible
      || (ordinaryWeaponVisible && !nativeStaffVisible && modStaffFront !== true)
    )
    this.orbFrontBase.container.visible = !death.visible
      && elementEffectVisible
      && ordinaryStaffVisible
      && plan.orbPasses.frontBase
    this.orbFrontOverlay.container.visible = !death.visible
      && elementEffectVisible
      && ordinaryStaffVisible
      && plan.orbPasses.frontOverlay
    this.damageX4FrontBase.container.visible = this.orbFrontBase.container.visible
      && selectedPrimaryAvailable
      && player.progression.damageX4TicksRemaining > 0
    this.damageX4FrontOverlay.container.visible = this.orbFrontOverlay.container.visible
      && selectedPrimaryAvailable
      && player.progression.damageX4TicksRemaining > 0
    this.robe.visible = !death.visible
    this.robeSecondary.visible = !death.visible && robeHasSecondary
    this.unselectedRobeAttachment.visible = !death.visible
      && unselectedRobeAttachmentVisible
    this.fixed.visible = !death.visible
    this.fixedSecondary.visible = !death.visible && robeHasSecondary
    this.staffFront.visible = !death.visible && (
      fallbackAttachmentVisible
      || (ordinaryWeaponVisible && !nativeStaffVisible && modStaffFront !== false)
    )
    this.head.visible = !death.visible
    this.headSecondary.visible = !death.visible && hatHasSecondary
    this.updateDeathLayers(playerTextures, death, deathAppearance)
    const hitAlpha = playerHitOverlayAlpha(player.progression, tick)
    this.hitOverlay.alpha = hitAlpha
    this.hitOverlay.visible = !death.visible && hitAlpha > 0
    this.hitStaffBack.visible = fallbackAttachmentVisible
      || (ordinaryWeaponVisible && modStaffFront !== true)
    this.hitRobe.visible = true
    this.hitRobeSecondary.visible = robeHasSecondary
    this.hitUnselectedRobeAttachment.visible = unselectedRobeAttachmentVisible
    this.hitFixed.visible = true
    this.hitFixedSecondary.visible = robeHasSecondary
    this.hitStaffFront.visible = fallbackAttachmentVisible
      || (ordinaryWeaponVisible && modStaffFront !== false)
    this.hitHead.visible = true
    this.hitHeadSecondary.visible = hatHasSecondary
    if (plan.unselectedPrimaryAttachment) {
      const back = this.textures.equipment.unselectedAttachment.back[heading]
        ?.[NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE]
      const front = this.textures.equipment.unselectedAttachment.front[heading]
        ?.[NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE]
      if (back === undefined || front === undefined) {
        throw new RangeError('Missing selected-primary -1 attachment pose 4')
      }
      this.staffBack.texture = back
      this.staffFront.texture = front
      this.hitStaffBack.texture = back
      this.hitStaffFront.texture = front
    } else if (bareAttachmentVisible && plan.bareAttachmentPose !== null) {
      const back = this.textures.equipment.bareAttachment.back[heading]
        ?.[plan.bareAttachmentPose]
      const front = this.textures.equipment.bareAttachment.front[heading]
        ?.[plan.bareAttachmentPose]
      if (back === undefined || front === undefined) {
        throw new RangeError(`Missing bare attachment pose ${plan.bareAttachmentPose}`)
      }
      this.staffBack.texture = back
      this.staffFront.texture = front
      this.hitStaffBack.texture = back
      this.hitStaffFront.texture = front
    } else if (modWeaponTextures !== null) {
      const texture = wearableFrame(modWeaponTextures, 'primary', heading, attachmentPose)
      this.staffBack.texture = texture
      this.staffFront.texture = texture
      this.hitStaffBack.texture = texture
      this.hitStaffFront.texture = texture
    } else if (weaponTextures !== null) {
      this.staffBack.texture = weaponTextures.back[heading]![attachmentPose]!
      this.staffFront.texture = weaponTextures.front[heading]![attachmentPose]!
      this.hitStaffBack.texture = weaponTextures.back[heading]![attachmentPose]!
      this.hitStaffFront.texture = weaponTextures.front[heading]![attachmentPose]!
    }
    this.unselectedRobeAttachment.texture =
      this.textures.equipment.unselectedAttachment.robe[heading]!
    this.unselectedRobeAttachment.position.set(fixedOffset.x, fixedOffset.y)
    if (livingAppearance.robe === null) {
      this.robe.texture = playerTextures.robe[heading]![pose]!
      this.fixed.texture = playerTextures.fixed[heading]![robeFixedPose]!
      this.robePrimaryTint = 0xffffff
      this.robeSecondaryTint = 0xffffff
    } else if (modRobeTextures !== null && isPlayerModEquipmentAppearance(livingAppearance.robe!)) {
      this.robe.texture = wearableFrame(modRobeTextures, 'primary', heading, pose)
      if (modRobeTextures.secondary) {
        this.robeSecondary.texture = wearableFrame(modRobeTextures, 'secondary', heading, pose)
      }
      this.fixed.texture = this.textures.equipment.robeFixed.primary[heading]![robeFixedPose]!
      this.fixedSecondary.texture = this.textures.equipment.robeFixed.secondary[heading]![robeFixedPose]!
      this.robePrimaryTint = livingAppearance.robe.primaryTint
      this.robeSecondaryTint = livingAppearance.robe.secondaryTint
    } else {
      if (isPlayerModEquipmentAppearance(livingAppearance.robe!)) {
        throw new RangeError('Missing mod robe wearable textures')
      }
      const robeTextures = this.textures.equipment.robes[livingAppearance.robe.selector]
      if (robeTextures === undefined) {
        throw new RangeError(`Missing native robe selector ${livingAppearance.robe.selector}`)
      }
      this.robe.texture = robeTextures.primary[heading]![pose]!
      this.robeSecondary.texture = robeTextures.secondary[heading]![pose]!
      this.fixed.texture = this.textures.equipment.robeFixed.primary[heading]![robeFixedPose]!
      this.fixedSecondary.texture = this.textures.equipment.robeFixed.secondary[heading]![robeFixedPose]!
      this.robePrimaryTint = livingAppearance.robe.primaryTint
      this.robeSecondaryTint = livingAppearance.robe.secondaryTint
    }
    this.fixed.position.set(fixedOffset.x, fixedOffset.y)
    this.fixedSecondary.position.set(fixedOffset.x, fixedOffset.y)
    this.staffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    const planewalkerActive = (this.secondaryState?.planewalkerTicksRemaining ?? 0) > 0
    const nativeStaffSelector = nativeStaffVisible
      && livingAppearance.weapon !== null
      && !isPlayerModEquipmentAppearance(livingAppearance.weapon)
      ? livingAppearance.weapon.selector
      : 0
    this.enchantStaff.update({
      headingIndex: heading,
      learnedSkills: player.progression.learnedSkills,
      living: !death.visible,
      nativeStaff: nativeStaffVisible,
      pose: attachmentPose,
      selectedPrimarySkillId: planewalkerActive
        ? 80
        : player.progression.selectedPrimarySkillId,
      selector: nativeStaffSelector,
      tick,
      weldBuildId: planewalkerActive ? null : player.progression.weldBuildId,
    }, plan.staffFront)
    this.enchantStaff.container.position.set(
      plan.staffFront ? attachmentOffset.x : 0,
      plan.staffFront ? attachmentOffset.y : 0,
    )
    if (livingAppearance.hat === null) {
      this.head.texture = playerTextures.head[heading]!
      this.headPrimaryTint = 0xffffff
      this.headSecondaryTint = 0xffffff
    } else if (modHatTextures !== null && isPlayerModEquipmentAppearance(livingAppearance.hat!)) {
      this.head.texture = wearableFrame(modHatTextures, 'primary', heading, 0)
      if (modHatTextures.secondary) {
        this.headSecondary.texture = wearableFrame(modHatTextures, 'secondary', heading, 0)
      }
      this.headPrimaryTint = livingAppearance.hat.primaryTint
      this.headSecondaryTint = livingAppearance.hat.secondaryTint
    } else {
      if (isPlayerModEquipmentAppearance(livingAppearance.hat!)) {
        throw new RangeError('Missing mod hat wearable textures')
      }
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
    this.hitUnselectedRobeAttachment.texture = this.unselectedRobeAttachment.texture
    this.hitUnselectedRobeAttachment.position.set(fixedOffset.x, fixedOffset.y)
    this.hitFixed.texture = this.fixed.texture
    this.hitFixedSecondary.texture = this.fixedSecondary.texture
    this.hitFixed.position.set(fixedOffset.x, fixedOffset.y)
    this.hitFixedSecondary.position.set(fixedOffset.x, fixedOffset.y)
    this.hitStaffFront.position.set(attachmentOffset.x, attachmentOffset.y)
    this.hitHead.texture = this.head.texture
    this.hitHeadSecondary.texture = this.headSecondary.texture
    this.hitHead.position.set(headOffset.x, headOffset.y)
    this.hitHeadSecondary.position.set(headOffset.x, headOffset.y)
    for (const view of [
      this.damageX4FrontBase,
      this.orbFrontBase,
      this.damageX4FrontOverlay,
      this.orbFrontOverlay,
    ]) {
      view.container.position.set(
        orbOffset.x + attachmentOffset.x,
        orbOffset.y + attachmentOffset.y,
      )
    }
    this.currentElementEffectScale = playerEquippedElementEffectScale(
      player.lighting.overlayEffectPhase,
    )
    const selectedPrimaryId = (this.secondaryState?.planewalkerTicksRemaining ?? 0) > 0
      ? 80
      : player.primaryCast.selectedPrimaryId
    this.damageX4FrontBase.update(
      player.progression.damageX4TicksRemaining,
      tick,
      this.currentElementEffectScale,
    )
    this.damageX4FrontOverlay.update(
      player.progression.damageX4TicksRemaining,
      tick,
      this.currentElementEffectScale,
    )
    this.orbFrontBase.updateSelectedPrimary(
      selectedPrimaryId,
      tick,
      this.currentElementEffectScale,
    )
    this.orbFrontOverlay.updateSelectedPrimary(
      selectedPrimaryId,
      tick,
      this.currentElementEffectScale,
    )
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

  get elementEffectPrimaryId(): number | null {
    return this.orbFrontBase.selectedPrimaryId
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

  /**
   * Scripted Hub travel (College intro, portal transitions) faces the visible
   * displacement of the presented sprite rather than the replicated heading,
   * so correction smoothing cannot move one direction while painting another.
   * The facing is anchored to the last point the sprite turned at and only
   * turns again after ACTOR_MOVEMENT_FACING_DISTANCE of travel, which keeps a
   * sub-tick reconciliation ripple from flipping the sprite for a frame.
   */
  private resolveHeadingIndex(player: ProtocolPlayerState, movementFacing: boolean): number {
    if (!movementFacing) {
      this.movementFacingState = null
      return player.headingIndex
    }
    const facing = advanceActorMovementFacing(
      this.movementFacingState
        ?? createActorMovementFacingState(player.position.x, player.position.y),
      player.position.x,
      player.position.y,
    )
    this.movementFacingState = facing
    return facing.headingIndex ?? player.headingIndex
  }

  get headingIndex(): number {
    return this.currentHeadingIndex
  }

  get weaponScale(): number {
    return this.staffBack.scale.x
  }

  get ordinaryWeaponVisible(): boolean {
    return this.currentOrdinaryWeaponVisible
  }

  get robeFixedPose(): number {
    return this.currentRobeFixedPose
  }

  get unselectedPrimaryAttachment(): boolean {
    return this.currentUnselectedPrimaryAttachment
  }

  get unselectedRobeAttachmentVisible(): boolean {
    return this.unselectedRobeAttachment.visible
  }

  get magicShieldAlpha(): number {
    return this.magicShield.alpha
  }

  get magicShieldScale(): number {
    return this.magicShield.scale.x
  }

  get magicShieldVisible(): boolean {
    return this.magicShield.visible
  }

  get damageX4Alpha(): number {
    return Math.max(this.damageX4FrontBase.alpha, this.damageX4FrontOverlay.alpha)
  }

  get damageX4SpriteCount(): number {
    return this.damageX4FrontBase.visibleSpriteCount
      + this.damageX4FrontOverlay.visibleSpriteCount
  }

  get enchantStaffActive(): boolean {
    return this.enchantStaff.active
  }

  get enchantStaffAuraRecord(): number | null {
    return this.enchantStaff.auraRecord
  }

  get enchantStaffAlpha(): number {
    return this.enchantStaff.nearAlpha
  }

  get enchantStaffTint(): number | null {
    return this.enchantStaff.tint
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
    this.magicShield.alpha = plan.alpha
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
    this.unselectedRobeAttachment.tint = tint
    this.fixed.tint = multiplyTints(this.robePrimaryTint, tint)
    this.fixedSecondary.tint = multiplyTints(this.robeSecondaryTint, tint)
    this.staffFront.tint = tint
    this.enchantStaff.setMaterialTint(tint)
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
    this.container.removeChild(this.enchantStaff.container)
    this.enchantStaff.destroy()
    for (const view of [this.damageX4FrontBase, this.damageX4FrontOverlay]) {
      this.container.removeChild(view.container)
      view.destroy()
    }
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

function wearableFrame(
  textures: ModWearableTextureFrames,
  layer: 'primary' | 'secondary',
  heading: number,
  pose: number,
): Texture {
  const bank = layer === 'primary' ? textures.primary : textures.secondary
  const poses = bank?.[heading]
  if (!poses || poses.length === 0) throw new RangeError(`Missing mod wearable ${layer} frame`)
  return poses[Math.min(pose, poses.length - 1)]!
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
