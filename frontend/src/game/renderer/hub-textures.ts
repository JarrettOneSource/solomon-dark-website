import { Texture } from 'pixi.js'
import { hub } from '../../lib/assets.ts'
import { WIZARD_ELEMENTS } from '../core-kernels/player-character.ts'
import {
  hubGameAssetSources,
  loadGameImage,
  releaseGameImages,
} from '../game-assets.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  gridFrames,
  stripFrames,
  type PlayerWorldTextures,
} from './world-player-textures.ts'

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

export interface HubWorldTextures extends PlayerWorldTextures {
  assetSources: readonly string[]
  astronomer: HubAstronomerTextureFrames
  base: Readonly<Record<string, Texture>>
  potion: HubPotionTextureFrames
  students: HubStudentTextureFrames
  teacher: HubTeacherTextureFrames
}

export async function loadHubWorldTextures(): Promise<HubWorldTextures> {
  const sources = [...new Set(WIZARD_ELEMENTS.flatMap(hubGameAssetSources))]
  let images: readonly (readonly [string, HTMLImageElement])[]
  try {
    images = await Promise.all(sources.map(async (source) => [
      source,
      await loadGameImage(source),
    ] as const))
  } catch (error) {
    releaseGameImages(sources)
    throw error
  }
  const loaded: Array<readonly [string, Texture]> = []
  try {
    for (const [source, image] of images) loaded.push([source, Texture.from(image, true)])
  } catch (error) {
    for (const [, texture] of loaded) texture.destroy(true)
    releaseGameImages(sources)
    throw error
  }
  releaseGameImages(sources)
  const base = Object.fromEntries(loaded) as Record<string, Texture>
  const texture = (source: string) => {
    const result = base[source]
    if (!result) throw new Error(`Hub texture was not loaded: ${source}`)
    return result
  }

  const playerWorld = createPlayerWorldTextures(texture)
  const assistantFrames = stripFrames(
    texture(hub.astronomer.assistants),
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
        gesture: stripFrames(texture(hub.astronomer.green.gesture), 5, 450, 450, 'horizontal'),
        idle: stripFrames(texture(hub.astronomer.green.idle), 4, 450, 450, 'horizontal'),
        transition: stripFrames(texture(hub.astronomer.green.transition), 3, 450, 450, 'horizontal'),
      },
      red: {
        gesture: stripFrames(texture(hub.astronomer.red.gesture), 5, 450, 450, 'horizontal'),
        idle: stripFrames(texture(hub.astronomer.red.idle), 4, 450, 450, 'horizontal'),
        transition: stripFrames(texture(hub.astronomer.red.transition), 3, 450, 450, 'horizontal'),
      },
      telescope: stripFrames(texture(hub.astronomer.telescope), 5, 374, 292, 'horizontal'),
    },
    base,
    potion: {
      actor: stripFrames(texture(hub.npcs.potion), 5, 35, 49, 'horizontal'),
      balloons: stripFrames(texture(hub.tent.balloons), 5, 54, 72, 'horizontal'),
    },
    students: {
      head: stripFrames(texture(hub.npcs.studentHead), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
      props: hub.npcs.studentProps.map((source) => stripFrames(texture(source), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical')),
      read: gridFrames(texture(hub.npcs.studentRead), ACTOR_WALK_FRAMES, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE),
      walk: gridFrames(texture(hub.npcs.studentWalk), ACTOR_WALK_FRAMES, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE),
    },
    teacher: {
      actor: stripFrames(texture(hub.npcs.teacher.frames), 4, 150, 150, 'horizontal'),
      burst: stripFrames(texture(hub.npcs.teacher.burst.frames), 11, 31, 140, 'horizontal'),
    },
  }
}

export function destroyHubWorldTextureFrames(textures: HubWorldTextures): void {
  const derived = new Set<Texture>()
  const add = (frames: readonly Texture[]) => frames.forEach((frame) => derived.add(frame))
  add(textures.astronomer.assistants.blue)
  add(textures.astronomer.assistants.brown)
  add(textures.astronomer.assistants.gray)
  add(textures.astronomer.assistants.purple)
  add(textures.astronomer.green.gesture)
  add(textures.astronomer.green.idle)
  add(textures.astronomer.green.transition)
  add(textures.astronomer.red.gesture)
  add(textures.astronomer.red.idle)
  add(textures.astronomer.red.transition)
  add(textures.astronomer.telescope)
  destroyPlayerWorldTextureFrames(textures)
  add(textures.potion.actor)
  add(textures.potion.balloons)
  add(textures.students.head)
  textures.students.props.forEach(add)
  textures.students.read.forEach(add)
  textures.students.walk.forEach(add)
  add(textures.teacher.actor)
  add(textures.teacher.burst)
  for (const texture of derived) texture.destroy(false)
  for (const texture of Object.values(textures.base)) texture.destroy(true)
}
