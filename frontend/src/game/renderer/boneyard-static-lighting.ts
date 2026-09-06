import { NATIVE, type Vec2 } from '../../editor/model.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import {
  NativeBoneyardLightIndex,
  nativeBoneyardLightTint,
  nativeBoneyardSurfaceLightScalar,
} from './boneyard-lighting.ts'
import type {
  BuildingResidents,
  ResidentTexture,
  TreeResidents,
  WallResident,
} from './boneyard-renderer-model.ts'
import { writeNativeWallVertexScalars } from './boneyard-static-surface-lighting.ts'
import {
  BoneyardTreeOcclusionPresentation,
  type NativeTreeOcclusionInput,
} from './boneyard-tree-occlusion.ts'

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function isBuildingLayer(layer: MainLayer): boolean {
  return layer.kind === 'object' && layer.object.typeId === NATIVE.building
}

export class BoneyardStaticLighting {
  private readonly earthquakeTreeWobbles = new Map<string, number>()
  private readonly treeOcclusion: BoneyardTreeOcclusionPresentation
  private readonly boneyard: LoadedBoneyard
  private readonly mainLayers: readonly MainLayer[]
  private readonly buildingResidents: ReadonlyMap<string, BuildingResidents>
  private readonly wallResidents: ReadonlyMap<number, WallResident>
  private readonly treeResidents: ReadonlyMap<string, TreeResidents>
  constructor(
    boneyard: LoadedBoneyard,
    mainLayers: readonly MainLayer[],
    buildingResidents: ReadonlyMap<string, BuildingResidents>,
    wallResidents: ReadonlyMap<number, WallResident>,
    treeResidents: ReadonlyMap<string, TreeResidents>,
    treeInputs: readonly NativeTreeOcclusionInput[],
    initialTick: number,
  ) {
    this.boneyard = boneyard
    this.mainLayers = mainLayers
    this.buildingResidents = buildingResidents
    this.wallResidents = wallResidents
    this.treeResidents = treeResidents
    this.treeOcclusion = new BoneyardTreeOcclusionPresentation(treeInputs, initialTick)
  }
  update(
    snapshot: GameSnapshot,
    localPlayerPosition: Readonly<Vec2>,
    visibleMainResidents: readonly ResidentTexture[],
    complexLighting: boolean,
    lightIndex: NativeBoneyardLightIndex,
    worldLightScalar: (position: Vec2) => number,
  ) {
    let maxMainLightScalar = 0
    let minMainLightScalar = 1
    let monumentVisibleCount = 0
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const layer = this.mainLayers[layerIndex]
      if (isBuildingLayer(layer)) continue
      if (layer.kind === 'object' && layer.object.typeId === NATIVE.monument) {
        monumentVisibleCount += 1
      }
      const scalar = worldLightScalar(layer.pos)
      resident.sprite.tint = nativeBoneyardLightTint(scalar)
      maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
      minMainLightScalar = Math.min(minMainLightScalar, scalar)
    }
    let buildingBaseRoofColorMismatchCount = 0
    let buildingVertexLightMaximum = 0
    let buildingVertexLightMinimum = 1
    let buildingVisibleCount = 0
    for (const building of this.buildingResidents.values()) {
      if (!building.main.sprite.renderable) continue
      buildingVisibleCount += 1
      for (let index = 0; index < building.samplePoints.length; index += 1) {
        const scalar = complexLighting
          ? nativeBoneyardSurfaceLightScalar(
              building.samplePoints[index]!,
              lightIndex,
            )
          : 1
        building.scalars[index] = scalar
        buildingVertexLightMaximum = Math.max(buildingVertexLightMaximum, scalar)
        buildingVertexLightMinimum = Math.min(buildingVertexLightMinimum, scalar)
        maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
        minMainLightScalar = Math.min(minMainLightScalar, scalar)
      }
      building.main.surfaceMesh.update(building.scalars)
      building.roof.surfaceMesh.update(building.scalars)
      building.main.sprite.tint = 0xffffff
      building.roof.sprite.tint = 0xffffff
      if (!equalBytes(
        building.main.surfaceMesh.colors,
        building.roof.surfaceMesh.colors,
      )) {
        buildingBaseRoofColorMismatchCount += 1
      }
    }
    let wallVertexLightMaximum = 0
    let wallVertexLightMinimum = 1
    let wallVisibleCount = 0
    for (const wall of this.wallResidents.values()) {
      if (!wall.resident.sprite.renderable) continue
      wallVisibleCount += 1
      const startScalar = complexLighting
        ? nativeBoneyardSurfaceLightScalar(wall.start, lightIndex)
        : 1
      const endScalar = complexLighting
        ? nativeBoneyardSurfaceLightScalar(wall.end, lightIndex)
        : 1
      writeNativeWallVertexScalars(
        wall.scalars,
        wall.vertexWeights,
        startScalar,
        endScalar,
      )
      wall.resident.surfaceMesh.update(wall.scalars)
      wall.resident.sprite.tint = 0xffffff
      for (const scalar of wall.scalars) {
        wallVertexLightMaximum = Math.max(wallVertexLightMaximum, scalar)
        wallVertexLightMinimum = Math.min(wallVertexLightMinimum, scalar)
        maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
        minMainLightScalar = Math.min(minMainLightScalar, scalar)
      }
    }
    const treePresentations = this.treeOcclusion.update(
      snapshot.tick,
      localPlayerPosition,
    )
    const earthquakeTreeWobbles = this.earthquakeTreeWobbles
    earthquakeTreeWobbles.clear()
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (
        actor.kind !== 'earthquake-scenery-wobble'
        || actor.worldKey !== `boneyard:${this.boneyard.runId}`
        || actor.targetId === null
      ) continue
      const object = this.boneyard.scene.objects[actor.targetId]
      if (object) earthquakeTreeWobbles.set(object.eid, actor.phase)
    }
    let fadedTreeCount = 0
    let minTreeAlpha = 1
    let minTreeLightScalar = 1
    let treeAlphaMismatchCount = 0
    let treeTintMismatchCount = 0
    for (const presentation of treePresentations) {
      const tree = this.treeResidents.get(presentation.eid)
      if (!tree) continue
      const scalar = worldLightScalar(presentation.position)
      const tint = nativeBoneyardLightTint(scalar)
      tree.main.sprite.alpha = presentation.alpha
      tree.proxy.sprite.alpha = presentation.alpha
      tree.main.sprite.tint = tint
      tree.proxy.sprite.tint = tint
      const wobbleRadians = (earthquakeTreeWobbles.get(presentation.eid) ?? 0)
        * Math.PI / 180
      for (const resident of [tree.main, tree.proxy]) {
        resident.sprite.pivot.set(
          presentation.position.x - resident.x,
          presentation.position.y - resident.y,
        )
        resident.sprite.position.set(
          presentation.position.x,
          presentation.position.y,
        )
        resident.sprite.rotation = wobbleRadians
      }
      if (presentation.alpha < 1) fadedTreeCount += 1
      minTreeAlpha = Math.min(minTreeAlpha, presentation.alpha)
      minTreeLightScalar = Math.min(minTreeLightScalar, scalar)
      if (tree.main.sprite.alpha !== tree.proxy.sprite.alpha) {
        treeAlphaMismatchCount += 1
      }
      if (tree.main.sprite.tint !== tree.proxy.sprite.tint) {
        treeTintMismatchCount += 1
      }
    }
    return { maxMainLightScalar, minMainLightScalar, monumentVisibleCount, buildingBaseRoofColorMismatchCount, buildingVertexLightMaximum, buildingVertexLightMinimum, buildingVisibleCount, wallVertexLightMaximum, wallVertexLightMinimum, wallVisibleCount, fadedTreeCount, minTreeAlpha, minTreeLightScalar, treeAlphaMismatchCount, treeTintMismatchCount, treePresentations }
  }
}
