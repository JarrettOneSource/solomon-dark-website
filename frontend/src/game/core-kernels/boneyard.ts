export interface BoneyardPoint {
  x: number
  y: number
}

export interface BoneyardBounds extends BoneyardPoint {
  w: number
  h: number
}

export interface BoneyardObject {
  eid: string
  typeId: number
  pos: BoneyardPoint
  variant?: number
  rot?: number
  scale?: number
  sortBias?: number
  atlasEntry?: number
  secondaryAtlasEntry?: number
  secondaryVariant?: number
  secondaryVisible?: boolean
  overlayAtlasEntry?: number
  overlayVariant?: number
  atlasEntries?: readonly number[]
}

export interface BoneyardSprite {
  eid: string
  atlasEntry: number
  deadHawgEntry?: number
  pos: BoneyardPoint
  s0: number
  s1: number
  s2: number
  flags: number
}

export interface BoneyardRoad {
  eid: string
  typeId: number
  points: readonly BoneyardPoint[]
  style?: number
  startWidthScale?: number
  endWidthScale?: number
  quad?: readonly BoneyardPoint[]
}

export interface BoneyardFence {
  eid: string
  typeId: number
  points: readonly BoneyardPoint[]
  style?: number
  segmentCode?: number
}

export interface BoneyardTerrain {
  eid: string
  pos: BoneyardPoint
  points?: readonly BoneyardPoint[]
  style?: number
  entry?: number
}

export interface SolomonDigState {
  position: BoneyardPoint
  frameProgram: readonly number[]
  ticksPerFrame: number
}

export interface BoneyardScene {
  name: string
  bounds: BoneyardBounds
  spawn: {
    x: number
    y: number
    facingDeg: number
  }
  objects: readonly BoneyardObject[]
  sprites: readonly BoneyardSprite[]
  roads: readonly BoneyardRoad[]
  fences: readonly BoneyardFence[]
  terrain: readonly BoneyardTerrain[]
  solomonDig: SolomonDigState
}

export interface BoneyardChoice {
  id: string
  name: string
  source: 'default' | 'mod'
  modId?: string
  modName?: string
}

export interface LoadedBoneyard {
  choice: BoneyardChoice
  runId: string
  seed: string
  sourceSha256: string
  geometrySha256: string
  scene: BoneyardScene
}

export interface NativeBoneyardTemplate {
  sourceLabel: string
  sourceSha256: string
  geometrySha256: string
  scene: BoneyardScene
}
