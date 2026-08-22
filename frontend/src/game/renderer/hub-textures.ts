import { Texture } from 'pixi.js'
import { boneyard, hub } from '../../lib/assets.ts'
import { WIZARD_ELEMENTS } from '../core-kernels/player-character.ts'
import { hubGameAssetSources } from '../game-assets.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  gridFrames,
  playerWorldAssetSources,
  stripFrames,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import { loadGameTextureEntries } from './game-webgl.ts'

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
  levelUpSparkle: Texture
  potion: HubPotionTextureFrames
  students: HubStudentTextureFrames
  teacher: HubTeacherTextureFrames
  traders: HubTraderTextureFrames
}

export function hubWorldAssetSources(): readonly string[] {
  return [...new Set([
    ...WIZARD_ELEMENTS.flatMap(hubGameAssetSources),
    ...playerWorldAssetSources(),
    boneyard.levelUpSparkle,
  ])]
}

export async function loadHubWorldTextures(): Promise<HubWorldTextures> {
  const sources = hubWorldAssetSources()
  const loaded = await loadGameTextureEntries(sources)
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
    levelUpSparkle: texture(boneyard.levelUpSparkle),
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
    traders: {
      hagatha: {
        body: stripFrames(texture(hub.npcs.perkWitchFrames), 8, 150, 150, 'horizontal'),
        crossfades: stripFrames(texture(hub.npcs.perkWitchCrossfades), 4, 25, 25, 'horizontal'),
      },
      luthacus: stripFrames(texture(hub.npcs.itemsFrames), 4, 200, 200, 'horizontal'),
      shlorio: stripFrames(texture(hub.rooms.library.dowser), 4, 150, 150, 'horizontal'),
    },
  }
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
    textures.teacher.burst[0],
    textures.traders.hagatha.body[0],
    textures.traders.hagatha.crossfades[0],
    textures.traders.luthacus[0],
    textures.traders.shlorio[0],
  ]
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
  add(textures.traders.hagatha.body)
  add(textures.traders.hagatha.crossfades)
  add(textures.traders.luthacus)
  add(textures.traders.shlorio)
  for (const texture of derived) texture.destroy(false)
  for (const texture of Object.values(textures.base)) texture.destroy(true)
}
