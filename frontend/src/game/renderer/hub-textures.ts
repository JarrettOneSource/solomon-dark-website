import { Texture } from 'pixi.js'
import { boneyard, hub } from '../../lib/assets.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  playerWorldAssetSources,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import {
  HUB_VISUAL_ATLAS_ORIGINAL_SOURCES,
  HUB_VISUAL_ATLAS_SOURCES,
  createHubVisualAtlas,
  hubVisualAtlasSourceIsSingle,
  type HubVisualAtlas,
} from './hub-visual-atlas.ts'
import { loadGameTextureEntries } from './game-webgl.ts'
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
  type BoneyardCombatAtlas,
} from './boneyard-combat-atlas.ts'
import { boneyardCombatAssetSource } from './boneyard-combat-asset-source.ts'

const ACTOR_FRAME_SIZE = 170
const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5

export interface HubStudentTextureFrames {
  head: readonly Texture[]
  props: readonly (readonly Texture[])[]
  read: readonly (readonly Texture[])[]
  walk: readonly (readonly Texture[])[]
}

export interface HubTeacherTextureFrames {
  actor: readonly Texture[]
  burst: readonly Texture[]
}

export interface HubPotionTextureFrames {
  actor: readonly Texture[]
  balloons: readonly Texture[]
}

export interface HubAstronomerTextureFrames {
  assistants: {
    blue: readonly Texture[]
    brown: readonly Texture[]
    gray: readonly Texture[]
    purple: readonly Texture[]
  }
  green: {
    gesture: readonly Texture[]
    idle: readonly Texture[]
    transition: readonly Texture[]
  }
  red: {
    gesture: readonly Texture[]
    idle: readonly Texture[]
    transition: readonly Texture[]
  }
  telescope: readonly Texture[]
}

export interface HubTraderTextureFrames {
  hagatha: {
    body: readonly Texture[]
    crossfades: readonly Texture[]
  }
  luthacus: readonly Texture[]
  shlorio: readonly Texture[]
}

export interface HubWorldTextures extends PlayerWorldTextures {
  assetSources: readonly string[]
  astronomer: HubAstronomerTextureFrames
  base: Readonly<Record<string, Texture>>
  combatAtlas: BoneyardCombatAtlas
  levelUpSparkle: Texture
  potion: HubPotionTextureFrames
  skorcha: readonly Texture[]
  students: HubStudentTextureFrames
  teacher: HubTeacherTextureFrames
  traders: HubTraderTextureFrames
  visualAtlas: HubVisualAtlas
}

export function hubWorldAssetSources(): readonly string[] {
  const requestedSources = hubRequestedAssetSources()
  return [...new Set([
    ...HUB_VISUAL_ATLAS_SOURCES,
    ...requestedSources.filter((source) => !boneyardCombatAtlasSourceIsPacked(source)),
    ...BONEYARD_COMBAT_ATLAS_SOURCES,
  ])]
}

export async function loadHubWorldTextures(): Promise<HubWorldTextures> {
  const packedSources = hubRequestedAssetSources().filter(boneyardCombatAtlasSourceIsPacked)
  const sources = hubWorldAssetSources()
  const loaded = await loadGameTextureEntries(sources)
  const base = Object.fromEntries(loaded) as Record<string, Texture>
  const texture = (source: string) => {
    const result = base[boneyardCombatAssetSource(source)]
    if (!result) throw new Error(`Hub texture was not loaded: ${source}`)
    return result
  }
  const combatAtlas = createBoneyardCombatAtlas(texture)
  for (const source of packedSources) base[source] = combatAtlas.single(source)
  const visualAtlas = createHubVisualAtlas(texture)
  for (const source of HUB_VISUAL_ATLAS_ORIGINAL_SOURCES) {
    if (hubVisualAtlasSourceIsSingle(source)) base[source] = visualAtlas.single(source)
  }

  const playerWorld = createPlayerWorldTextures(texture)
  const assistantFrames = visualAtlas.strip(
    hub.astronomer.assistants,
    12,
    150,
    150,
    'horizontal',
  )

  return {
    ...playerWorld,
    assetSources: sources,
    astronomer: {
      assistants: {
        gray: assistantFrames.slice(0, 3),
        blue: assistantFrames.slice(3, 6),
        brown: assistantFrames.slice(6, 9),
        purple: assistantFrames.slice(9, 12),
      },
      green: {
        gesture: visualAtlas.strip(hub.astronomer.green.gesture, 5, 450, 450, 'horizontal'),
        idle: visualAtlas.strip(hub.astronomer.green.idle, 4, 450, 450, 'horizontal'),
        transition: visualAtlas.strip(hub.astronomer.green.transition, 3, 450, 450, 'horizontal'),
      },
      red: {
        gesture: visualAtlas.strip(hub.astronomer.red.gesture, 5, 450, 450, 'horizontal'),
        idle: visualAtlas.strip(hub.astronomer.red.idle, 4, 450, 450, 'horizontal'),
        transition: visualAtlas.strip(hub.astronomer.red.transition, 3, 450, 450, 'horizontal'),
      },
      telescope: visualAtlas.strip(hub.astronomer.telescope, 5, 374, 292, 'horizontal'),
    },
    base,
    combatAtlas,
    levelUpSparkle: texture(boneyard.levelUpSparkle),
    potion: {
      actor: visualAtlas.strip(hub.npcs.potion, 5, 35, 49, 'horizontal'),
      balloons: visualAtlas.strip(hub.tent.balloons, 5, 54, 72, 'horizontal'),
    },
    skorcha: visualAtlas.strip(hub.npcs.skorchaFrames, 7, 350, 350, 'horizontal'),
    students: {
      head: visualAtlas.strip(hub.npcs.studentHead, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
      props: hub.npcs.studentProps.map((source) => visualAtlas.strip(source, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical')),
      read: visualAtlas.grid(hub.npcs.studentRead, ACTOR_WALK_FRAMES, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE),
      walk: visualAtlas.grid(hub.npcs.studentWalk, ACTOR_WALK_FRAMES, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE),
    },
    teacher: {
      actor: visualAtlas.strip(hub.npcs.teacher.frames, 4, 150, 150, 'horizontal'),
      burst: visualAtlas.strip(hub.npcs.teacher.burst.frames, 11, 31, 140, 'horizontal'),
    },
    traders: {
      hagatha: {
        body: visualAtlas.strip(hub.npcs.perkWitchFrames, 8, 150, 150, 'horizontal'),
        crossfades: visualAtlas.strip(hub.npcs.perkWitchCrossfades, 4, 25, 25, 'horizontal'),
      },
      luthacus: visualAtlas.strip(hub.npcs.itemsFrames, 4, 200, 200, 'horizontal'),
      shlorio: visualAtlas.strip(hub.rooms.library.dowser, 4, 150, 150, 'horizontal'),
    },
    visualAtlas,
  }
}

function hubRequestedAssetSources(): readonly string[] {
  return [
    ...playerWorldAssetSources(),
    boneyardCombatAssetSource(boneyard.levelUpSparkle),
  ]
}

/** Sources selected only by later ambient animation branches. */
export function hubDeferredAnimationTextures(
  textures: HubWorldTextures,
): readonly Texture[] {
  return [
    textures.astronomer.assistants.blue[0],
    textures.astronomer.green.gesture[0],
    textures.astronomer.green.idle[0],
    textures.astronomer.green.transition[0],
    textures.astronomer.red.gesture[0],
    textures.astronomer.red.idle[0],
    textures.astronomer.red.transition[0],
    textures.astronomer.telescope[0],
    textures.base[hub.npcs.teacher.burst.column],
    textures.base[hub.npcs.teacher.burst.core],
    textures.base[hub.npcs.teacher.burst.flare],
    textures.skorcha[0],
    textures.teacher.burst[0],
    textures.traders.hagatha.body[0],
    textures.traders.hagatha.crossfades[0],
    textures.traders.luthacus[0],
    textures.traders.shlorio[0],
  ]
}

export function destroyHubWorldTextureFrames(textures: HubWorldTextures): void {
  textures.visualAtlas.destroy()
  destroyPlayerWorldTextureFrames(textures)
  textures.combatAtlas.destroy()
  for (const source of textures.assetSources) textures.base[source].destroy(true)
}
