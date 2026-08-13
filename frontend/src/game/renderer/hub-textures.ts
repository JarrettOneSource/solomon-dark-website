import { Rectangle, Texture } from 'pixi.js'
import { elementVfx, hub, playerCharacter } from '../../lib/assets.ts'
import {
  WIZARD_ELEMENTS,
  type WizardElement,
} from '../core-kernels/player-character.ts'
import {
  hubGameAssetSources,
  loadGameImage,
  releaseGameImages,
} from '../game-assets.ts'
import {
  NATIVE_ELEMENT_VFX_SPRITES,
  type NativeElementVfxSprite,
} from '../element-vfx-native.ts'

const ACTOR_FRAME_SIZE = 170
const ACTOR_HEADINGS = 24
const ACTOR_WALK_FRAMES = 5

export interface HubActorTextureFrames {
  fixed: readonly Texture[]
  head: readonly Texture[]
  robe: readonly (readonly Texture[])[]
  staffBack: readonly Texture[]
  staffFront: readonly Texture[]
}

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

export interface HubWorldTextures {
  assetSources: readonly string[]
  base: Readonly<Record<string, Texture>>
  elementVfx: Readonly<Partial<Record<NativeElementVfxSprite, readonly Texture[]>>>
  players: Readonly<Record<WizardElement, HubActorTextureFrames>>
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

  const playerTextures = (element: WizardElement): HubActorTextureFrames => ({
    fixed: stripFrames(texture(playerCharacter.robeFixed[element]), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
    head: stripFrames(texture(playerCharacter.head[element]), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
    robe: gridFrames(texture(playerCharacter.robeDynamic[element]), ACTOR_WALK_FRAMES, ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE),
    staffBack: stripFrames(texture(playerCharacter.staffBack), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
    staffFront: stripFrames(texture(playerCharacter.staffFront), ACTOR_HEADINGS, ACTOR_FRAME_SIZE, ACTOR_FRAME_SIZE, 'vertical'),
  })
  const players = {
    air: playerTextures('air'),
    earth: playerTextures('earth'),
    ether: playerTextures('ether'),
    fire: playerTextures('fire'),
    water: playerTextures('water'),
  } satisfies Record<WizardElement, HubActorTextureFrames>

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

  return {
    assetSources: sources,
    base,
    elementVfx: elementTextures,
    players,
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
  for (const player of Object.values(textures.players)) {
    add(player.fixed)
    add(player.head)
    player.robe.forEach(add)
    add(player.staffBack)
    add(player.staffFront)
  }
  add(textures.potion.actor)
  add(textures.potion.balloons)
  add(textures.students.head)
  textures.students.props.forEach(add)
  textures.students.read.forEach(add)
  textures.students.walk.forEach(add)
  add(textures.teacher.actor)
  add(textures.teacher.burst)
  Object.values(textures.elementVfx).forEach(add)
  for (const texture of derived) texture.destroy(false)
  for (const texture of Object.values(textures.base)) texture.destroy(true)
}

function stripFrames(
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

function gridFrames(
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
