import { Rectangle, Texture } from 'pixi.js'

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

const ACTOR_FRAME_SIZE = 170
const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5
const ACTOR_ATTACHMENT_POSES = 10
const ACTOR_DEATH_FACINGS = 6
const ACTOR_DEATH_FRAMES = 4

export interface PlayerActorTextureFrames {
  death: readonly (readonly Texture[])[]
  deathAttachment: readonly (readonly Texture[])[]
  fixed: readonly (readonly Texture[])[]
  head: readonly Texture[]
  robe: readonly (readonly Texture[])[]
  staffBack: readonly (readonly Texture[])[]
  staffFront: readonly (readonly Texture[])[]
}

export interface PlayerWorldTextures {
  elementVfx: Readonly<Record<NativeElementVfxSprite, readonly Texture[]>>
  playerShadow: Texture
  players: Readonly<Record<WizardElement, PlayerActorTextureFrames>>
  primarySpells: {
    air: {
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
}

export function playerWorldAssetSources(): string[] {
  return collectAssetSources({
    elementVfx,
    playerCharacter,
    playerShadow: hub.npcs.teacher.shadow,
    primarySpells,
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
    deathAttachment: gridFrames(
      texture(playerCharacter.deathAttachment),
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
  return {
    elementVfx: elementTextures,
    playerShadow: texture(hub.npcs.teacher.shadow),
    players,
    primarySpells: {
      air: {
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
    player.deathAttachment.forEach(add)
    player.fixed.forEach(add)
    add(player.head)
    player.robe.forEach(add)
    player.staffBack.forEach(add)
    player.staffFront.forEach(add)
  }
  Object.values(textures.elementVfx).forEach(add)
  add(textures.primarySpells.fire.impacts)
  add(textures.primarySpells.fire.particles)
  for (const texture of derived) texture.destroy(false)
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
