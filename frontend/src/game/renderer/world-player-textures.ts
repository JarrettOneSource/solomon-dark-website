import { Rectangle, Texture } from 'pixi.js'

import { elementVfx, hub, playerCharacter } from '../../lib/assets.ts'
import {
  WIZARD_ELEMENTS,
  type WizardElement,
} from '../core-kernels/player-character.ts'
import {
  NATIVE_ELEMENT_VFX_SPRITES,
  type NativeElementVfxSprite,
} from '../element-vfx-native.ts'
import { collectAssetSources } from '../game-asset-readiness.ts'
import type { NativeElementVfxTextures } from './native-element-vfx-view.ts'

const ACTOR_FRAME_SIZE = 170
const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5

export interface PlayerActorTextureFrames {
  fixed: readonly Texture[]
  head: readonly Texture[]
  robe: readonly (readonly Texture[])[]
  staffBack: readonly Texture[]
  staffFront: readonly Texture[]
}

export interface PlayerWorldTextures {
  elementVfx: NativeElementVfxTextures
  playerShadow: Texture
  players: Readonly<Record<WizardElement, PlayerActorTextureFrames>>
}

export function playerWorldAssetSources(): string[] {
  return collectAssetSources({
    elementVfx,
    playerCharacter,
    playerShadow: hub.npcs.teacher.shadow,
  })
}

export function createPlayerWorldTextures(
  texture: (source: string) => Texture,
): PlayerWorldTextures {
  const playerTextures = (element: WizardElement): PlayerActorTextureFrames => ({
    fixed: stripFrames(
      texture(playerCharacter.robeFixed[element]),
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
      'vertical',
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
    staffBack: stripFrames(
      texture(playerCharacter.staffBack),
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
      'vertical',
    ),
    staffFront: stripFrames(
      texture(playerCharacter.staffFront),
      ACTOR_HEADINGS,
      ACTOR_FRAME_SIZE,
      ACTOR_FRAME_SIZE,
      'vertical',
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
  }
}

export function createNativeElementVfxTextures(
  texture: (source: string) => Texture,
): NativeElementVfxTextures {
  const elementTextures: Partial<Record<NativeElementVfxSprite, readonly Texture[]>> = {}
  for (const sprite of ['core', 'ray', 'spark', 'air', 'earth', 'fire', 'water'] as const) {
    const metrics = NATIVE_ELEMENT_VFX_SPRITES[sprite]
    const source = sprite === 'core' || sprite === 'ray' || sprite === 'spark'
      ? elementVfx.common[sprite]
      : elementVfx.frames[sprite]
    elementTextures[sprite] = stripFrames(
      texture(source),
      metrics.count,
      metrics.width,
      metrics.height,
      'horizontal',
    )
  }
  return elementTextures
}

export function destroyPlayerWorldTextureFrames(textures: PlayerWorldTextures): void {
  const derived = new Set<Texture>()
  const add = (frames: readonly Texture[]) => frames.forEach((frame) => derived.add(frame))
  for (const player of Object.values(textures.players)) {
    add(player.fixed)
    add(player.head)
    player.robe.forEach(add)
    add(player.staffBack)
    add(player.staffFront)
  }
  Object.values(textures.elementVfx).forEach(add)
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
