import { Rectangle, Texture } from 'pixi.js'

import deathHatAnchors from '../../assets/game/player-character-death-hat-anchors.json'
import {
  elementVfx,
  hub,
  playerCharacter,
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
} from './native-secondary-assets.ts'

const ACTOR_FRAME_SIZE = 170
const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5
const ACTOR_ATTACHMENT_POSES = 10
const ACTOR_DEATH_FACINGS = 6
const ACTOR_DEATH_FRAMES = 4

export interface PlayerActorTextureFrames {
  death: readonly (readonly Texture[])[]
  fixed: readonly (readonly Texture[])[]
  head: readonly Texture[]
  robe: readonly (readonly Texture[])[]
  staffBack: readonly (readonly Texture[])[]
  staffFront: readonly (readonly Texture[])[]
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
  playerShadow: Texture
  players: Readonly<Record<WizardElement, PlayerActorTextureFrames>>
  primarySpells: {
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
    etherPierceStreak: Texture
  }
  secondary: Readonly<Record<string, Texture>>
  secondarySpecial: {
    etherPlane: Texture
  }
}

export function playerWorldAssetSources(): string[] {
  return collectAssetSources({
    elementVfx,
    fontAtlas: hub.hud.fontAtlas,
    playerCharacter,
    playerShadow: hub.npcs.teacher.shadow,
    primarySpells,
    secondary: NATIVE_SECONDARY_ASSET_SOURCES,
  })
}

export function createPlayerWorldTextures(
  texture: (source: string) => Texture,
): PlayerWorldTextures {
  const playerTextures = (element: WizardElement): PlayerActorTextureFrames => ({
    death: gridFrames(
      texture(playerCharacter.death[element]),
      ACTOR_DEATH_FRAMES,
      ACTOR_DEATH_FACINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
    ),
    fixed: gridFrames(
      texture(playerCharacter.robeFixed[element]),
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
    ),
    head: stripFrames(
      texture(playerCharacter.head[element]),
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
      'vertical',
    ),
    robe: gridFrames(
      texture(playerCharacter.robeDynamic[element]),
      ACTOR_WALK_FRAMES,
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
    ),
    staffBack: gridFrames(
      texture(playerCharacter.staffBack),
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
    ),
    staffFront: gridFrames(
      texture(playerCharacter.staffFront),
      ACTOR_ATTACHMENT_POSES,
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
    ),
  })
  const players = Object.fromEntries(WIZARD_ELEMENTS.map((element) => [
    element,
    playerTextures(element),
  ])) as Record<WizardElement, PlayerActorTextureFrames>
  const elementTextures = createNativeElementVfxTextures(texture)
  const deathGrid = (source: string): Texture[][] => gridFrames(
    texture(source),
    ACTOR_DEATH_FRAMES,
    ACTOR_DEATH_FACINGS,
    ACTOR_FRAME_SIZE,
    ACTOR_FRAME_SIZE,
  )
  const etherPlane = texture(NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES.etherPlane)
  etherPlane.source.addressMode = 'repeat'
  return {
    death: {
      hat: {
        primary: playerCharacter.deathHat.primary.map((source) => stripFrames(
          texture(source),
          ACTOR_HEADINGS,
          ACTOR_FRAME_SIZE,
          ACTOR_FRAME_SIZE,
          'vertical',
        )),
        secondary: playerCharacter.deathHat.secondary.map((source) => stripFrames(
          texture(source),
          ACTOR_HEADINGS,
          ACTOR_FRAME_SIZE,
          ACTOR_FRAME_SIZE,
          'vertical',
        )),
        specialPrimary: stripFrames(
          texture(playerCharacter.deathHat.specialPrimary),
          ACTOR_DEATH_FACINGS,
          ACTOR_FRAME_SIZE,
          ACTOR_FRAME_SIZE,
          'vertical',
        ),
        specialSecondary: stripFrames(
          texture(playerCharacter.deathHat.specialSecondary),
          ACTOR_DEATH_FACINGS,
          ACTOR_FRAME_SIZE,
          ACTOR_FRAME_SIZE,
          'vertical',
        ),
      },
      robe: {
        fixedPrimary: playerCharacter.deathRobe.fixedPrimary.map(deathGrid),
        fixedSecondary: playerCharacter.deathRobe.fixedSecondary.map(deathGrid),
        primary: playerCharacter.deathRobe.primary.map(deathGrid),
        secondary: playerCharacter.deathRobe.secondary.map(deathGrid),
      },
      weapon: {
        staff: playerCharacter.deathWeapon.staff.map(texture),
        wand: texture(playerCharacter.deathWeapon.wand),
      },
    },
    elementVfx: elementTextures,
    fontAtlas: texture(hub.hud.fontAtlas),
    playerShadow: texture(hub.npcs.teacher.shadow),
    players,
    primarySpells: {
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
    core: frames('core'),
    earth: frames('earth'),
    fire: frames('fire'),
    ray: frames('ray'),
    spark: frames('spark'),
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
