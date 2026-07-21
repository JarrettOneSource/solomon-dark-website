export type Point = Readonly<{
  x: number
  y: number
}>

export type Bounds = Readonly<{
  minX: number
  minY: number
  maxX: number
  maxY: number
}>

export type SyncChunk = Readonly<{
  offset: number
  payload: Uint8Array
  children: readonly SyncChunk[]
}>

export type NamedSyncBuffer = Readonly<{
  name: string
  root: SyncChunk
  namedBuffers: readonly NamedSyncBuffer[]
}>

export type WorldObject = Readonly<{
  kind: 'worldObject'
  index: number
  typeId: number
  typeName: string
  position: Point
  velocity: Point
  variant: number | null
  chunks: readonly SyncChunk[]
}>

export type Road = Readonly<{
  kind: 'road'
  index: number
  start: Point
  end: Point
  uid: number
  previousUid: number | null
  nextUid: number | null
  quad: readonly Point[]
  style: number
  startScale: number
  endScale: number
  chunk: SyncChunk
}>

export type Fence = Readonly<{
  kind: 'fence'
  index: number
  start: Point
  end: Point
  uid: number
  previousUid: number | null
  nextUid: number | null
  style: number
  chunk: SyncChunk
}>

export type Terrain = Readonly<{
  kind: 'terrain'
  index: number
  mode: number
  reserved: number
  points: readonly Point[]
  uid: number
  weights: readonly number[]
  scale: number
  chunk: SyncChunk
}>

export type SpritePlacement = Readonly<{
  kind: 'sprite'
  index: number
  atlasEntryId: number
  position: Point
  rotation: number
  scaleX: number
  scaleY: number
  flags: number
}>

export type SpawnPoint = Readonly<{
  kind: 'spawn'
  position: Point
  direction: number
}>

export type BoneyardScene = Readonly<{
  spawn: SpawnPoint
  worldObjects: readonly WorldObject[]
  roads: readonly Road[]
  fences: readonly Fence[]
  terrain: readonly Terrain[]
  sprites: readonly SpritePlacement[]
  bounds: Bounds
}>

export type BoneyardStats = Readonly<{
  bytes: number
  chunks: number
  namedBuffers: number
  maxDepth: number
}>

export type BoneyardDocument = Readonly<{
  internalName: string
  bytes: Uint8Array
  root: SyncChunk
  namedBuffers: readonly NamedSyncBuffer[]
  stats: BoneyardStats
  scene: BoneyardScene
  diagnostics: readonly string[]
}>

export type SceneSelection =
  | SpawnPoint
  | WorldObject
  | Road
  | Fence
  | Terrain
  | SpritePlacement

export type BoneyardLayers = Readonly<{
  grid: boolean
  terrain: boolean
  roads: boolean
  fences: boolean
  sprites: boolean
  objects: boolean
  spawn: boolean
}>

export const DEFAULT_BONEYARD_LAYERS: BoneyardLayers = {
  grid: true,
  terrain: true,
  roads: true,
  fences: true,
  sprites: true,
  objects: true,
  spawn: true,
}
