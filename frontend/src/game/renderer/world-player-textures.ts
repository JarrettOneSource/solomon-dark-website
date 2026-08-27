import { Rectangle, Texture } from 'pixi.js'

import deathHatAnchors from '../../assets/game/player-character-death-hat-anchors.json'
import {
  elementVfx,
  hub,
  primarySpells,
} from '../../lib/assets.ts'
import {
  WIZARD_ELEMENTS,
  type WizardElement,
} from '../core-kernels/player-character.ts'
import {
  NATIVE_ELEMENT_VFX_SPRITES,
  type NativeElementVfxSprite,
} from '../element-vfx-native.ts'
import { collectAssetSources } from '../game-asset-readiness.ts'
import {
  NATIVE_SECONDARY_ASSET_SOURCES,
  NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES,
  NATIVE_SECONDARY_SPRITE_RECORDS,
  nativeSecondarySpriteKey,
  nativeSecondarySpriteRecord,
} from './native-secondary-assets.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import type { NativeEnemySpriteRegistration } from './native-enemy-sprite-registration.ts'
import {
  PLAYER_CHARACTER_ATLAS_SOURCES,
  PLAYER_CHARACTER_SHEETS,
  createPlayerCharacterAtlas,
} from './player-character-atlas.ts'
import {
  NATIVE_WELD_BADGUYS_RECORDS,
  NATIVE_WELD_DEADHAWG_RECORDS,
  NATIVE_WELD_DEADHAWG_SPRITES,
  NATIVE_WELD_SPRITES,
} from './primary-spell-weld-native.ts'
import { boneyardCombatAssetSource } from './boneyard-combat-asset-source.ts'

const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5
const ACTOR_ATTACHMENT_POSES = 10
const ACTOR_DEATH_FACINGS = 6
const ACTOR_DEATH_FRAMES = 4
const NATIVE_FIRE_ACTOR_BADGUYS_RECORDS = Object.freeze([
  15,
  ...integerRange(251, 254),
  ...integerRange(267, 270),
  ...integerRange(285, 342),
  ...integerRange(401, 433),
])
const NATIVE_FIRE_ACTOR_DEADHAWG_RECORDS = Object.freeze(integerRange(46, 77))

export interface NativeFireActorTextures {
  badGuys: Readonly<Record<number, Texture>>
  deadHawg: Readonly<Record<number, Texture>>
}

export interface NativeWeldTexture extends NativeEnemySpriteRegistration {
  readonly texture: Texture
}

export interface PlayerActorTextureFrames {
  death: readonly (readonly Texture[])[]
  fixed: readonly (readonly Texture[])[]
  head: readonly Texture[]
  robe: readonly (readonly Texture[])[]
  staffBack: readonly (readonly Texture[])[]
  staffFront: readonly (readonly Texture[])[]
}

export interface PlayerLivingEquipmentTextureFrames {
  readonly hats: readonly Readonly<{
    primary: readonly Texture[]
    secondary: readonly Texture[]
  }>[]
  readonly robeFixed: Readonly<{
    primary: readonly (readonly Texture[])[]
    secondary: readonly (readonly Texture[])[]
  }>
  readonly robes: readonly Readonly<{
    primary: readonly (readonly Texture[])[]
    secondary: readonly (readonly Texture[])[]
  }>[]
  readonly staffs: readonly Readonly<{
    back: readonly (readonly Texture[])[]
    front: readonly (readonly Texture[])[]
  }>[]
  readonly wand: Readonly<{
    back: readonly (readonly Texture[])[]
    front: readonly (readonly Texture[])[]
  }>
}

export interface PlayerWorldTextures {
  death: {
    hat: {
      primary: readonly (readonly Texture[])[]
      secondary: readonly (readonly Texture[])[]
      specialPrimary: readonly Texture[]
      specialSecondary: readonly Texture[]
    }
    robe: {
      fixedPrimary: readonly (readonly (readonly Texture[])[])[]
      fixedSecondary: readonly (readonly (readonly Texture[])[])[]
      primary: readonly (readonly (readonly Texture[])[])[]
      secondary: readonly (readonly (readonly Texture[])[])[]
    }
    weapon: {
      staff: readonly Texture[]
      wand: Texture
    }
  }
  elementVfx: Readonly<Record<NativeElementVfxSprite, readonly Texture[]>>
  fontAtlas: Texture
  equipment: PlayerLivingEquipmentTextureFrames
  fireActors: NativeFireActorTextures
  playerShadow: Texture
  players: Readonly<Record<WizardElement, PlayerActorTextureFrames>>
  primarySpells: {
    etherBlast: Readonly<Record<11 | 45, Readonly<{
      anchorX: number
      anchorY: number
      height: number
      texture: Texture
      width: number
    }>>>
    airWaterActors: {
      coldAura: Texture
      hail: Texture
      hurricaneCore: Texture
      hurricaneLane: Texture
    }
    air: {
      branches: readonly Texture[]
      circle: Texture
      forks: readonly Texture[]
      ribbon: Texture
    }
    earth: {
      aura: Texture
      litRocks: readonly Texture[]
      openingFlash: Texture
      rocks: readonly Texture[]
    }
    fire: {
      core: Texture
      frames: readonly Texture[]
      impacts: readonly Texture[]
      particles: readonly Texture[]
    }
    frost: {
      core: Texture
      extra: Texture
      over: Texture
      spark: Texture
    }
    weldActors: Readonly<{
      BadGuys: Readonly<Record<number, NativeWeldTexture>>
      DeadHawg: Readonly<Record<number, NativeWeldTexture>>
    }>
    etherPierceStreak: Texture
  }
  secondary: Readonly<Record<string, Texture>>
  secondarySpecial: {
    etherPlane: Texture
  }
}

export function playerWorldAssetSources(): string[] {
  return [...new Set(collectAssetSources({
    elementVfx,
    fontAtlas: hub.hud.fontAtlas,
    fireActors: {
      badGuys: NATIVE_FIRE_ACTOR_BADGUYS_RECORDS.map((entry) => (
        nativeEnemySpriteRecord('BadGuys', entry).source
      )),
      deadHawg: NATIVE_FIRE_ACTOR_DEADHAWG_RECORDS.map((entry) => (
        nativeEnemySpriteRecord('DeadHawg', entry).source
      )),
    },
    playerAtlas: PLAYER_CHARACTER_ATLAS_SOURCES,
    playerShadow: hub.npcs.teacher.shadow,
    primarySpells,
    weldActors: {
      badGuys: NATIVE_WELD_BADGUYS_RECORDS.map((entry) => (
        nativeEnemySpriteRecord('BadGuys', entry).source
      )),
      deadHawg: NATIVE_WELD_DEADHAWG_RECORDS.map((entry) => (
        nativeEnemySpriteRecord('DeadHawg', entry).source
      )),
    },
    secondary: NATIVE_SECONDARY_ASSET_SOURCES,
  }).map(boneyardCombatAssetSource))]
}

export function createPlayerWorldTextures(
  resolveTexture: (source: string) => Texture,
): PlayerWorldTextures {
  const texture = (source: string): Texture => (
    resolveTexture(boneyardCombatAssetSource(source))
  )
  const playerCharacterAtlas = createPlayerCharacterAtlas(texture)
  const playerTextures = (element: WizardElement): PlayerActorTextureFrames => ({
    death: playerCharacterAtlas.grid(
      PLAYER_CHARACTER_SHEETS.death[element],
      ACTOR_DEATH_FRAMES,
      ACTOR_DEATH_FACINGS,
    ),
    fixed: playerCharacterAtlas.grid(
      PLAYER_CHARACTER_SHEETS.robeFixed[element],
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
    ),
    head: playerCharacterAtlas.strip(
      PLAYER_CHARACTER_SHEETS.head[element],
      ACTOR_HEADINGS,
    ),
    robe: playerCharacterAtlas.grid(
      PLAYER_CHARACTER_SHEETS.robeDynamic[element],
      ACTOR_WALK_FRAMES,
      ACTOR_HEADINGS,
    ),
    staffBack: playerCharacterAtlas.grid(
      PLAYER_CHARACTER_SHEETS.staffBack,
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
    ),
    staffFront: playerCharacterAtlas.grid(
      PLAYER_CHARACTER_SHEETS.staffFront,
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
    ),
  })
  const players = Object.fromEntries(WIZARD_ELEMENTS.map((element) => [
    element,
    playerTextures(element),
  ])) as Record<WizardElement, PlayerActorTextureFrames>
  const elementTextures = createNativeElementVfxTextures(texture)
  const equipment: PlayerLivingEquipmentTextureFrames = {
    hats: PLAYER_CHARACTER_SHEETS.hatStyles.map((style) => ({
      primary: playerCharacterAtlas.strip(style.primary, ACTOR_HEADINGS),
      secondary: playerCharacterAtlas.strip(style.secondary, ACTOR_HEADINGS),
    })),
    robeFixed: {
      primary: playerCharacterAtlas.grid(
        PLAYER_CHARACTER_SHEETS.robeFixedLayers.primary,
        ACTOR_ATTACHMENT_POSES,
        ACTOR_HEADINGS,
      ),
      secondary: playerCharacterAtlas.grid(
        PLAYER_CHARACTER_SHEETS.robeFixedLayers.secondary,
        ACTOR_ATTACHMENT_POSES,
        ACTOR_HEADINGS,
      ),
    },
    robes: PLAYER_CHARACTER_SHEETS.robeStyles.map((style) => ({
      primary: playerCharacterAtlas.grid(style.primary, ACTOR_WALK_FRAMES, ACTOR_HEADINGS),
      secondary: playerCharacterAtlas.grid(style.secondary, ACTOR_WALK_FRAMES, ACTOR_HEADINGS),
    })),
    staffs: PLAYER_CHARACTER_SHEETS.staffStyles.map((style) => ({
      back: playerCharacterAtlas.grid(style.back, ACTOR_ATTACHMENT_POSES, ACTOR_HEADINGS),
      front: playerCharacterAtlas.grid(style.front, ACTOR_ATTACHMENT_POSES, ACTOR_HEADINGS),
    })),
    wand: {
      back: playerCharacterAtlas.grid(
        PLAYER_CHARACTER_SHEETS.wand.back,
        ACTOR_ATTACHMENT_POSES,
        ACTOR_HEADINGS,
      ),
      front: playerCharacterAtlas.grid(
        PLAYER_CHARACTER_SHEETS.wand.front,
        ACTOR_ATTACHMENT_POSES,
        ACTOR_HEADINGS,
      ),
    },
  }
  const deathGrid = (name: string): Texture[][] => playerCharacterAtlas.grid(
    name,
    ACTOR_DEATH_FRAMES,
    ACTOR_DEATH_FACINGS,
  )
  const etherPlane = texture(NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES.etherPlane)
  etherPlane.source.addressMode = 'repeat'
  return {
    death: {
      hat: {
        primary: PLAYER_CHARACTER_SHEETS.deathHat.primary.map((name) => (
          playerCharacterAtlas.strip(
            name,
            ACTOR_HEADINGS,
          )
        )),
        secondary: PLAYER_CHARACTER_SHEETS.deathHat.secondary.map((name) => (
          playerCharacterAtlas.strip(
            name,
            ACTOR_HEADINGS,
          )
        )),
        specialPrimary: playerCharacterAtlas.strip(
          PLAYER_CHARACTER_SHEETS.deathHat.specialPrimary,
          ACTOR_DEATH_FACINGS,
        ),
        specialSecondary: playerCharacterAtlas.strip(
          PLAYER_CHARACTER_SHEETS.deathHat.specialSecondary,
          ACTOR_DEATH_FACINGS,
        ),
      },
      robe: {
        fixedPrimary: PLAYER_CHARACTER_SHEETS.deathRobe.fixedPrimary.map(deathGrid),
        fixedSecondary: PLAYER_CHARACTER_SHEETS.deathRobe.fixedSecondary.map(deathGrid),
        primary: PLAYER_CHARACTER_SHEETS.deathRobe.primary.map(deathGrid),
        secondary: PLAYER_CHARACTER_SHEETS.deathRobe.secondary.map(deathGrid),
      },
      weapon: {
        staff: PLAYER_CHARACTER_SHEETS.deathWeapon.staff.map((name) => (
          playerCharacterAtlas.single(name)
        )),
        wand: playerCharacterAtlas.single(PLAYER_CHARACTER_SHEETS.deathWeapon.wand),
      },
    },
    elementVfx: elementTextures,
    fontAtlas: texture(hub.hud.fontAtlas),
    equipment,
    fireActors: {
      badGuys: nativeRecordTextures(texture, 'BadGuys', NATIVE_FIRE_ACTOR_BADGUYS_RECORDS),
      deadHawg: nativeRecordTextures(texture, 'DeadHawg', NATIVE_FIRE_ACTOR_DEADHAWG_RECORDS),
    },
    playerShadow: texture(hub.npcs.teacher.shadow),
    players,
    primarySpells: {
      etherBlast: Object.freeze(Object.fromEntries([11, 45].map((entry) => {
        const record = nativeSecondarySpriteRecord('BadGuys', entry)
        return [entry, Object.freeze({
          anchorX: record.anchorX,
          anchorY: record.anchorY,
          height: record.height,
          texture: texture(record.source),
          width: record.width,
        })]
      }))) as PlayerWorldTextures['primarySpells']['etherBlast'],
      airWaterActors: {
        coldAura: texture(primarySpells.airWaterActors.coldAura),
        hail: texture(primarySpells.airWaterActors.hail),
        hurricaneCore: texture(primarySpells.airWaterActors.hurricaneCore),
        hurricaneLane: texture(primarySpells.airWaterActors.hurricaneLane),
      },
      air: {
        branches: primarySpells.air.branches.map(texture),
        circle: texture(primarySpells.air.circle),
        forks: primarySpells.air.forks.map(texture),
        ribbon: texture(primarySpells.air.ribbon),
      },
      earth: {
        aura: texture(primarySpells.earth.aura),
        litRocks: primarySpells.earth.litRocks.map(texture),
        openingFlash: texture(primarySpells.earth.openingFlash),
        rocks: primarySpells.earth.rocks.map(texture),
      },
      fire: {
        core: texture(primarySpells.fire.core),
        frames: elementTextures.fire,
        impacts: stripFrames(
          texture(primarySpells.fire.impact),
          4,
          80,
          80,
          'horizontal',
        ),
        particles: stripFrames(
          texture(primarySpells.fire.particles),
          4,
          25,
          25,
          'horizontal',
        ),
      },
      frost: {
        core: texture(primarySpells.frost.core),
        extra: texture(primarySpells.frost.extra),
        over: texture(primarySpells.frost.over),
        spark: texture(primarySpells.frost.spark),
      },
      weldActors: Object.freeze({
        BadGuys: Object.freeze(Object.fromEntries(
          NATIVE_WELD_BADGUYS_RECORDS.map((entry) => [entry, {
            ...NATIVE_WELD_SPRITES[entry],
            texture: texture(nativeEnemySpriteRecord('BadGuys', entry).source),
          }]),
        )),
        DeadHawg: Object.freeze(Object.fromEntries(
          NATIVE_WELD_DEADHAWG_RECORDS.map((entry) => [entry, {
            ...NATIVE_WELD_DEADHAWG_SPRITES[entry],
            texture: texture(nativeEnemySpriteRecord('DeadHawg', entry).source),
          }]),
        )),
      }),
      etherPierceStreak: texture(primarySpells.etherPierceStreak),
    },
    secondary: Object.fromEntries(NATIVE_SECONDARY_SPRITE_RECORDS.map((record) => [
      nativeSecondarySpriteKey(record.atlas, record.entry),
      texture(record.source),
    ])),
    secondarySpecial: { etherPlane },
  }
}

export function createNativeElementVfxTextures(
  texture: (source: string) => Texture,
): Readonly<Record<NativeElementVfxSprite, readonly Texture[]>> {
  const frames = (sprite: NativeElementVfxSprite): readonly Texture[] => {
    if (sprite === 'aura') return [texture(elementVfx.special.aura)]
    if (sprite === 'steam') return elementVfx.special.steam.map(texture)
    const metrics = NATIVE_ELEMENT_VFX_SPRITES[sprite]
    const source = sprite === 'core' || sprite === 'ray' || sprite === 'spark'
      ? elementVfx.common[sprite]
      : elementVfx.frames[sprite]
    return stripFrames(
      texture(source),
      metrics.count,
      metrics.width,
      metrics.height,
      'horizontal',
    )
  }
  return {
    air: frames('air'),
    aura: frames('aura'),
    core: frames('core'),
    earth: frames('earth'),
    fire: frames('fire'),
    ray: frames('ray'),
    spark: frames('spark'),
    steam: frames('steam'),
    water: frames('water'),
  }
}

export function destroyPlayerWorldTextureFrames(textures: PlayerWorldTextures): void {
  const derived = new Set<Texture>()
  const add = (frames: readonly Texture[]) => frames.forEach((frame) => derived.add(frame))
  for (const player of Object.values(textures.players)) {
    player.death.forEach(add)
    player.fixed.forEach(add)
    add(player.head)
    player.robe.forEach(add)
    player.staffBack.forEach(add)
    player.staffFront.forEach(add)
  }
  textures.death.hat.primary.forEach(add)
  textures.death.hat.secondary.forEach(add)
  add(textures.death.hat.specialPrimary)
  add(textures.death.hat.specialSecondary)
  textures.death.robe.fixedPrimary.forEach((sheet) => sheet.forEach(add))
  textures.death.robe.fixedSecondary.forEach((sheet) => sheet.forEach(add))
  textures.death.robe.primary.forEach((sheet) => sheet.forEach(add))
  textures.death.robe.secondary.forEach((sheet) => sheet.forEach(add))
  for (const hat of textures.equipment.hats) {
    add(hat.primary)
    add(hat.secondary)
  }
  textures.equipment.robeFixed.primary.forEach(add)
  textures.equipment.robeFixed.secondary.forEach(add)
  for (const robe of textures.equipment.robes) {
    robe.primary.forEach(add)
    robe.secondary.forEach(add)
  }
  for (const staff of textures.equipment.staffs) {
    staff.back.forEach(add)
    staff.front.forEach(add)
  }
  textures.equipment.wand.back.forEach(add)
  textures.equipment.wand.front.forEach(add)
  Object.values(textures.elementVfx).forEach(add)
  add(textures.primarySpells.fire.impacts)
  add(textures.primarySpells.fire.particles)
  for (const texture of derived) texture.destroy(false)
}

export function playerDeathHatAnchor(frame: number, facing: number): {
  readonly x: number
  readonly y: number
} {
  const offset = deathHatAnchors.offsets[frame]?.[facing]
  if (
    offset === undefined
    || offset.length !== 2
    || !Number.isFinite(offset[0])
    || !Number.isFinite(offset[1])
  ) throw new RangeError(`Missing native death-hat anchor ${frame}:${facing}`)
  return { x: offset[0], y: offset[1] }
}

export function stripFrames(
  source: Texture,
  count: number,
  width: number,
  height: number,
  direction: 'horizontal' | 'vertical',
): Texture[] {
  return Array.from({ length: count }, (_, index) => new Texture({
    source: source.source,
    frame: new Rectangle(
      direction === 'horizontal' ? index * width : 0,
      direction === 'vertical' ? index * height : 0,
      width,
      height,
    ),
  }))
}

export function gridFrames(
  source: Texture,
  columns: number,
  rows: number,
  width: number,
  height: number,
): Texture[][] {
  return Array.from({ length: rows }, (_, row) => Array.from(
    { length: columns },
    (_, column) => new Texture({
      source: source.source,
      frame: new Rectangle(column * width, row * height, width, height),
    }),
  ))
}

function integerRange(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

function nativeRecordTextures(
  texture: (source: string) => Texture,
  atlas: 'BadGuys' | 'DeadHawg',
  entries: readonly number[],
): Readonly<Record<number, Texture>> {
  return Object.freeze(Object.fromEntries(entries.map((entry) => [
    entry,
    texture(nativeEnemySpriteRecord(atlas, entry).source),
  ])))
}
