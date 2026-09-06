import { BONEYARD_SPRITE_SOURCES, spriteImage } from '../../editor/assets.ts'
import { type EditorDoc, NATIVE } from '../../editor/model.ts'
import { nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import { NATIVE_BONEYARD_POST_ROAD_TEXTURES } from '../../editor/render.ts'
import type { BoneyardGateLeafSnapshot, LoadedBoneyard } from '../core-kernels/boneyard.ts'

export function nativeStaticProxyInsertions(layer: MainLayer) {
  if (layer.kind !== 'object') return undefined
  if (layer.object.typeId === NATIVE.tree) {
    const object = layer.object as typeof layer.object & {
      secondaryVisible?: boolean
    }
    if ((object.variant ?? 0) >= 6 || object.secondaryVisible === false) return undefined
    return Object.freeze([Object.freeze({
      id: `proxy:tree:${object.eid}`,
      sortBias: 0,
      visible: true,
      worldY: layer.worldY + 100,
    })])
  }
  if (layer.object.typeId === NATIVE.building) {
    return Object.freeze([Object.freeze({
      id: `proxy:building:${layer.object.eid}`,
      sortBias: 0,
      visible: true,
      worldY: layer.worldY + 200,
    })])
  }
  return undefined
}

export function isMovingGateBody(layer: MainLayer | undefined): layer is Extract<MainLayer, { kind: 'fence' }> {
  return Boolean(
    layer
    && layer.kind === 'fence'
    && layer.part === 'body'
    && (layer.fence.segmentCode ?? layer.fence.style ?? 0) === 2,
  )
}

export function runtimeMainWorldY(
  layer: MainLayer,
  gateLeaves: ReadonlyMap<string, BoneyardGateLeafSnapshot>,
): number {
  if (!isMovingGateBody(layer)) return layer.worldY
  const leaf = gateLeaves.get(`${layer.fence.eid}:${layer.pieceIndex}`)
  return leaf ? nativeGatePainterRoot(leaf.hinge, leaf.tip).y : layer.worldY
}

export function editorDocument(loaded: LoadedBoneyard): EditorDoc {
  const scene = loaded.scene
  return {
    meta: { name: scene.name, bounds: { ...scene.bounds } },
    objects: scene.objects.map((object) => ({ ...object, pos: { ...object.pos } })),
    sprites: scene.sprites.map((sprite) => ({
      ...sprite, pos: { ...sprite.pos },
      s2: sprite.atlasEntry >= 25 && sprite.atlasEntry <= 28 ? 0.75 : sprite.s2,
    })),
    roads: scene.roads.map((road) => ({
      ...road,
      points: road.points.map((point) => ({ ...point })),
      ...(road.quad ? { quad: road.quad.map((point) => ({ ...point })) } : {}),
    })),
    fences: scene.fences.map((fence) => ({
      ...fence,
      points: fence.points.map((point) => ({ ...point })),
    })),
    terrain: scene.terrain.map(({ points, ...terrain }) => ({
      ...terrain,
      ...(points ? { points: points.map((point) => ({ ...point })) } : {}),
    })),
    opaque: [],
    hasTimeline: false,
    spawn: { ...scene.spawn },
  }
}

export async function loadStaticPainterImages(): Promise<void> {
  await Promise.all([...new Set([
    ...BONEYARD_SPRITE_SOURCES,
    ...NATIVE_BONEYARD_POST_ROAD_TEXTURES,
  ])]
    .map(loadStaticPainterImage))
}

function loadStaticPainterImage(source: string): Promise<void> {
  const image = spriteImage(source)
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error(`could not load Boneyard painter asset: ${source}`))
    }
    const cleanup = () => {
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', failed)
    }
    image.addEventListener('load', loaded)
    image.addEventListener('error', failed)
  })
}
