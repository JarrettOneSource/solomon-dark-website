import type { SpriteRef, Vec2 } from '../../editor/model.ts'
import {
  NATIVE_LANTERN_LIGHT_FLICKER,
  NATIVE_LANTERN_LIGHT_MIN_INTENSITY,
  NATIVE_LANTERN_LIGHT_RADIUS,
  NATIVE_LIGHT_OUTER_DISTANCE,
  NATIVE_PLAYER_LIGHT_OFFSET,
  NATIVE_PLAYER_LIGHT_RADIUS,
  nativeBoneyardRadialLightContribution,
} from '../core-kernels/native-boneyard-lighting.ts'
import {
  nativeRandomFloatFromSemanticWord,
  nativeRandomIntFromSemanticWord,
  nativeSignedRandomFloatFromSemanticWords,
} from '../core-kernels/native-random-domain.ts'
import type {
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
} from '../protocol/game-state.ts'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import type {
  NativeWeldHailstonesState,
  NativeWeldEtherealBoulderState,
  NativeWeldMeteorActorState,
  NativeWeldProjectileState,
} from '../core-kernels/native-weld-primary-runtime.ts'
import { nativeSolomonDirtOrigin } from './boneyard-solomon-dirt-presentation.ts'

export {
  NATIVE_LANTERN_LIGHT_FLICKER,
  NATIVE_LANTERN_LIGHT_MIN_INTENSITY,
  NATIVE_LANTERN_LIGHT_RADIUS,
  NATIVE_LIGHT_INNER_DISTANCE,
  NATIVE_LIGHT_OUTER_DISTANCE,
  NATIVE_LIGHT_VERTICAL_SCALE,
  NATIVE_PLAYER_LIGHT_OFFSET,
  NATIVE_PLAYER_LIGHT_RADIUS,
} from '../core-kernels/native-boneyard-lighting.ts'

export interface NativeBoneyardLightSample {
  intensity: number
  position: Vec2
  radius: number
}

export interface NativeBoneyardLightSource extends NativeBoneyardLightSample {
  castsDirectionalShadow: boolean
  rasterScale?: number
}

export type NativeBoneyardLightProviderLane = 'actor' | 'transient'

export interface NativeBoneyardLightProviderCandidate {
  lane: NativeBoneyardLightProviderLane
  source: NativeBoneyardLightSource
}

export interface NativeBoneyardLightLookup {
  readonly acceptedSources: readonly NativeBoneyardLightSource[]
  scalarAt(position: Vec2): number
  sourceIndicesAt(position: Vec2): readonly number[]
}

export type NativeBoneyardLightSamples =
  | readonly NativeBoneyardLightSample[]
  | NativeBoneyardLightLookup

export interface NativeSolomonSetPieceLighting {
  digRootTint: number
  dirtTint: number
  lanternTint: number
}

interface NativePlayerLightOwner {
  headingIndex: number
  id: string
  lighting: {
    driveActive: boolean
    overlayEffectPhase: number
  }
  position: Vec2
}

interface NativeBoulderLightOwner {
  charge: number
  position: Vec2
}

interface NativeMissileLightOwner {
  id: number
  position: Vec2
}

interface NativeRegionLightViewport {
  height: number
  width: number
}

export interface NativeBoneyardLightManagerView {
  camera: {
    x: number
    y: number
    zoom: number
  }
  viewport: NativeRegionLightViewport
}

interface NativeLightGridExtent {
  height: number
  width: number
}

export interface NativeRegionLightTargetPlan {
  logicalSide: number
  physicalSide: number
  renderResolution: number
}

export const NATIVE_PLAYER_LIGHT_RASTER_JITTER = 0.2
export const NATIVE_DEFAULT_MULTIPLE_SHADOWS = true
export const NATIVE_DEFAULT_LIGHT_QUALITY = 0.25
export const NATIVE_LOW_CAPABILITY_LIGHT_QUALITY = Math.fround(0.06)
export const NATIVE_REGION_LIGHT_ATLAS = 'DeadHawg'
export const NATIVE_REGION_LIGHT_ENTRY = 18
export const NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX = 0.5
export const NATIVE_LIGHT_GRID_CELL_SIZE = 150

export interface NativeBoneyardWeatherLightingOrder {
  readonly lightCompositeZIndex: number
  readonly splashZIndex: number
  readonly streakZIndex: number
}

export function nativeBoneyardWeatherLightingOrder(
  foregroundZIndex: number,
  complexLighting: boolean,
): NativeBoneyardWeatherLightingOrder {
  const splashZIndex = NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX / 2
  const streakZIndex = foregroundZIndex + NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX
  return {
    lightCompositeZIndex: complexLighting
      ? NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX
      : streakZIndex + splashZIndex,
    splashZIndex,
    streakZIndex,
  }
}

const EMPTY_LIGHT_SOURCES: readonly NativeBoneyardLightSource[] = Object.freeze([])
const EMPTY_LIGHT_SOURCE_INDICES: readonly number[] = Object.freeze([])

interface NativeBoneyardLightBucket {
  generation: number
  sourceIndices: number[]
}

export class NativeBoneyardLightIndex implements NativeBoneyardLightLookup {
  private readonly accepted: NativeBoneyardLightSource[] = []
  private activeBuckets = 0
  private allocatedBuckets = 0
  private readonly columns = new Map<number, Map<number, NativeBoneyardLightBucket>>()
  private generation = 0
  private readonly maximumColumn: number
  private readonly maximumRow: number
  private indexedReferences = 0

  constructor(extent: NativeLightGridExtent) {
    this.maximumColumn = nativeLightGridInteriorCellCount(extent.width) + 1
    this.maximumRow = nativeLightGridInteriorCellCount(extent.height) + 1
  }

  rebuild(
    providerCandidates: readonly NativeBoneyardLightSource[],
    miscTailCandidates: readonly NativeBoneyardLightSource[] = EMPTY_LIGHT_SOURCES,
    view: NativeBoneyardLightManagerView,
    quality = NATIVE_DEFAULT_LIGHT_QUALITY,
  ): readonly NativeBoneyardLightSource[] {
    this.generation += 1
    this.accepted.length = 0
    this.activeBuckets = 0
    this.indexedReferences = 0
    this.appendCandidates(providerCandidates, view, quality)
    this.appendCandidates(miscTailCandidates, view, quality)
    return this.accepted
  }

  scalarAt(position: Vec2): number {
    let scalar = 0
    for (const sourceIndex of this.sourceIndicesAt(position)) {
      scalar = Math.max(
        scalar,
        nativeBoneyardLightContribution(position, this.accepted[sourceIndex]!),
      )
    }
    return scalar
  }

  sourceIndicesAt(position: Vec2): readonly number[] {
    const x = nativeLightGridCoordinate(position.x)
    const y = nativeLightGridCoordinate(position.y)
    if (
      x < -2
      || y < -2
      || x > this.maximumColumn
      || y > this.maximumRow
    ) return EMPTY_LIGHT_SOURCE_INDICES
    const column = this.columns.get(x)
    if (!column) return EMPTY_LIGHT_SOURCE_INDICES
    const bucket = column.get(y)
    return bucket?.generation === this.generation
      ? bucket.sourceIndices
      : EMPTY_LIGHT_SOURCE_INDICES
  }

  get acceptedSources(): readonly NativeBoneyardLightSource[] {
    return this.accepted
  }

  get activeBucketCount(): number {
    return this.activeBuckets
  }

  get allocatedBucketCount(): number {
    return this.allocatedBuckets
  }

  get indexedSourceReferenceCount(): number {
    return this.indexedReferences
  }

  private appendCandidates(
    candidates: readonly NativeBoneyardLightSource[],
    view: NativeBoneyardLightManagerView,
    quality: number,
  ): void {
    for (const source of candidates) {
      const candidate = nativeSubmittedBoneyardLightSource(source)
      if (!nativeBoneyardLightVisibleInManager(candidate, view, quality)) continue
      if (
        !candidate.castsDirectionalShadow
        && this.candidateContained(candidate)
      ) continue
      const acceptedIndex = this.accepted.length
      this.accepted.push(candidate)
      this.index(candidate, acceptedIndex)
    }
  }

  private candidateContained(candidate: NativeBoneyardLightSource): boolean {
    for (const sourceIndex of this.sourceIndicesAt(candidate.position)) {
      if (nativeLightContainsCandidate(this.accepted[sourceIndex]!, candidate)) {
        return true
      }
    }
    return false
  }

  private index(source: NativeBoneyardLightSource, acceptedIndex: number): void {
    const reach = Math.fround(
      Math.fround(source.radius) * Math.fround(NATIVE_LIGHT_OUTER_DISTANCE),
    )
    const minX = clampNativeLightGridCoordinate(
      nativeLightGridCoordinate(Math.fround(Math.fround(source.position.x) - reach)),
      this.maximumColumn,
    )
    const maxX = clampNativeLightGridCoordinate(
      nativeLightGridCoordinate(Math.fround(Math.fround(source.position.x) + reach)),
      this.maximumColumn,
    )
    const minY = clampNativeLightGridCoordinate(
      nativeLightGridCoordinate(Math.fround(Math.fround(source.position.y) - reach)),
      this.maximumRow,
    )
    const maxY = clampNativeLightGridCoordinate(
      nativeLightGridCoordinate(Math.fround(Math.fround(source.position.y) + reach)),
      this.maximumRow,
    )
    for (let x = minX; x <= maxX; x += 1) {
      let column = this.columns.get(x)
      if (!column) {
        column = new Map()
        this.columns.set(x, column)
      }
      for (let y = minY; y <= maxY; y += 1) {
        let bucket = column.get(y)
        if (!bucket) {
          bucket = { generation: 0, sourceIndices: [] }
          column.set(y, bucket)
          this.allocatedBuckets += 1
        }
        if (bucket.generation !== this.generation) {
          bucket.generation = this.generation
          bucket.sourceIndices.length = 0
          this.activeBuckets += 1
        }
        bucket.sourceIndices.push(acceptedIndex)
        this.indexedReferences += 1
      }
    }
  }
}

export function nativePlayerLightSource(
  player: NativePlayerLightOwner,
  presentationFrame: number,
  isLocalPlayer: boolean,
): NativeBoneyardLightSource | null {
  if (player.lighting.driveActive && !isLocalPlayer) return null
  const heading = player.headingIndex * 15 * Math.PI / 180
  return {
    intensity: 1,
    castsDirectionalShadow: true,
    position: {
      x: player.position.x + Math.sin(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
      y: player.position.y - Math.cos(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
    },
    radius: (1 + player.lighting.overlayEffectPhase) * NATIVE_PLAYER_LIGHT_RADIUS,
    rasterScale: Math.fround(
      Math.fround(NATIVE_PLAYER_LIGHT_RADIUS) - presentationRandom(
        presentationFrame,
        stableStringHash(player.id) ^ 0x5299a0,
        NATIVE_PLAYER_LIGHT_RASTER_JITTER,
      ),
    ),
  }
}

export function nativeLanternLightSource(
  position: Vec2,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  return {
    intensity: Math.fround(
      Math.fround(NATIVE_LANTERN_LIGHT_MIN_INTENSITY)
      + presentationRandom(presentationFrame, 0, NATIVE_LANTERN_LIGHT_FLICKER),
    ),
    castsDirectionalShadow: multipleShadows,
    position,
    radius: NATIVE_LANTERN_LIGHT_RADIUS,
  }
}

export function nativeMissileLightSource(
  owner: NativeMissileLightOwner,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: 0.75,
    position: { ...owner.position },
    radius: Math.fround(
      Math.fround(0.75)
      + presentationRandom(presentationFrame, owner.id ^ 0x5e4af0, 0.1),
    ),
  }
}

export function nativeBoulderLightSource(
  owner: NativeBoulderLightOwner,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: 0.5,
    position: { ...owner.position },
    radius: Math.max(1, 2 * owner.charge),
  }
}

export function nativeWeldProjectileLightSource(
  projectile: NativeWeldProjectileState,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  if (projectile.buildId !== 1009) {
    return nativeMissileLightSource(projectile, presentationFrame, multipleShadows)
  }
  return {
    castsDirectionalShadow: false,
    intensity: Math.fround(
      0.5 + presentationRandom(
        presentationFrame,
        projectile.id ^ 0x5e7800,
        0.5,
      ),
    ),
    position: { ...projectile.position },
    radius: Math.fround(0.4),
  }
}

export function nativeWeldRockLightSource(
  actor: NativeWeldEtherealBoulderState | NativeWeldHailstonesState,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: 0.5,
    position: { ...actor.origin },
    radius: Math.max(0.5, Math.fround(actor.scale * 0.75)),
  }
}

export function nativeWeldMeteorLightSource(
  actor: NativeWeldMeteorActorState,
): NativeBoneyardLightSource | null {
  if (actor.fallHeight > 1) return null
  const visibility = actor.phase === 'impact'
    ? Math.min(actor.impactTicksRemaining, 50) / 50
    : 1
  return {
    castsDirectionalShadow: false,
    intensity: Math.min(1, Math.fround(
      visibility * Math.fround(1 - actor.fallHeight),
    )),
    position: { ...actor.position },
    radius: Math.fround(actor.impactRadiusScalar * Math.fround(0.6)),
  }
}

export function nativeEnemyProjectileLightProvider(
  projectile: BoneyardEnemyProjectileSnapshot,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightProviderCandidate | null {
  switch (projectile.kind) {
    case 'arrow':
      if (projectile.payload !== 'fire') return null
      return {
        lane: 'transient',
        source: nativeFireProjectileLightSource(projectile, presentationFrame),
      }
    case 'firebolt':
      return {
        lane: 'transient',
        source: nativeFireProjectileLightSource(projectile, presentationFrame),
      }
    case 'guided-missile':
      return {
        lane: 'actor',
        source: nativeMissileLightSource(projectile, presentationFrame, multipleShadows),
      }
    case 'demon-bomb':
      return {
        lane: 'actor',
        source: {
          castsDirectionalShadow: false,
          intensity: Math.fround(1 - presentationRandom(
            presentationFrame,
            projectile.id ^ 0x5e98e0,
            0.25,
          )),
          position: { ...projectile.position },
          radius: 0.6,
        },
      }
    case 'poison-pool':
      return null
    default:
      return assertNever(projectile.kind)
  }
}

export function nativeEnemyProjectileEffectLightProvider(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): NativeBoneyardLightProviderCandidate | null {
  if (effect.kind !== 'fire-burst-glow') return null
  return {
    lane: 'transient',
    source: {
      castsDirectionalShadow: false,
      intensity: Math.max(0, 1 - Math.fround(0.04) * effect.ageTicks),
      position: { ...effect.position },
      radius: 1.5,
    },
  }
}

export function nativeEnemyLightSources(
  enemy: BoneyardEnemySnapshot,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): readonly NativeBoneyardLightSource[] {
  if (enemy.enemyToken === 'ZOMBIE' || enemy.lighting.providerCopies === 0) return []
  const result: NativeBoneyardLightSource[] = []
  const burning = enemy.flags.includes('FLAG_BURNING')
  for (let copy = 0; copy < enemy.lighting.providerCopies; copy += 1) {
    const salt = Math.imul(copy + 1, 0x45d9f3b) ^ enemy.id
    switch (enemy.enemyToken) {
      case 'SKELETON':
        result.push(nativeOrdinarySkeletonLight(enemy, presentationFrame, salt, multipleShadows))
        break
      case 'SKELETONARCHER':
      case 'SKELETONMAGE':
        result.push(burning
          ? nativeOrdinarySkeletonLight(enemy, presentationFrame, salt, multipleShadows)
          : {
              castsDirectionalShadow: multipleShadows,
              intensity: Math.fround(0.75 * Math.fround(enemy.lighting.charge)),
              position: { ...enemy.position },
              radius: Math.fround(
                Math.fround(enemy.lighting.charge)
                * Math.fround(0.5 + presentationSignedRandom(
                  presentationFrame,
                  salt ^ 0x4783e0,
                  0.1,
                )),
              ),
            })
        break
      case 'IMP':
        result.push({
          castsDirectionalShadow: false,
          intensity: Math.fround(
            Math.fround(enemy.lighting.glow)
            * Math.fround(0.75 + presentationRandom(
              presentationFrame,
              salt ^ 0x478cc0,
              0.25,
            )),
          ),
          position: { ...enemy.position },
          radius: Math.fround(0.25 + presentationSignedRandom(
            presentationFrame,
            salt ^ 0x478cc1,
            0.1,
          )),
        })
        break
      case 'WRAITH':
        result.push({
          castsDirectionalShadow: multipleShadows,
          intensity: Math.fround(
            Math.fround(enemy.lighting.glow)
            * Math.fround(0.5 + presentationRandom(
              presentationFrame,
              salt ^ 0x478e00,
              0.5,
            )),
          ),
          position: { ...enemy.position },
          radius: 0.5,
        })
        break
      case 'DEMON':
        result.push({
          castsDirectionalShadow: multipleShadows,
          intensity: enemy.animation.state === 'death'
            ? Math.fround(0.5 + presentationRandom(
                presentationFrame,
                salt ^ 0x479470,
                0.5,
              ))
            : 1,
          position: { ...enemy.position },
          radius: Math.fround(1.5 + presentationSignedRandom(
            presentationFrame,
            salt ^ 0x479471,
            0.25,
          )),
        })
        break
      case 'COFFIN':
        result.push({
          castsDirectionalShadow: multipleShadows,
          intensity: Math.fround(
            1 - presentationRandomInt(
              presentationFrame,
              salt ^ 0x479ea0,
              9,
            ) * 0.1,
          ),
          position: { ...enemy.position },
          radius: 0.65,
        })
        break
      default:
        assertNever(enemy.enemyToken)
    }
  }
  return result
}

function nativeOrdinarySkeletonLight(
  enemy: BoneyardEnemySnapshot,
  presentationFrame: number,
  salt: number,
  multipleShadows: boolean,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: Math.fround(
      Math.fround(enemy.lighting.glow)
      * Math.fround(0.5 + presentationRandom(
        presentationFrame,
        salt ^ 0x4779e0,
        0.5,
      )),
    ),
    position: { ...enemy.position },
    radius: 0.5,
  }
}

function presentationSignedRandom(
  frame: number,
  salt: number,
  magnitude: number,
): number {
  return nativeSignedRandomFloatFromSemanticWords(
    presentationRandomWord(frame, salt),
    presentationRandomWord(frame, salt ^ 0x7f4a7c15),
    magnitude,
  )
}

export function nativeRegionLightTargetPlan(
  viewport: NativeRegionLightViewport,
  deviceResolution: number,
  quality = NATIVE_DEFAULT_LIGHT_QUALITY,
): NativeRegionLightTargetPlan {
  const logicalSide = Math.max(viewport.width, viewport.height)
  const physicalSide = Math.max(1, Math.trunc(logicalSide * deviceResolution * quality))
  return {
    logicalSide,
    physicalSide,
    renderResolution: physicalSide / logicalSide,
  }
}

export function nativeSecondaryProviderLightSource(
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
  pointGain = 1,
): NativeBoneyardLightSource | null {
  if (actor.kind === 'moving-fire' || actor.kind === 'fire-patch') {
    if (!(actor.radius > 0)) return null
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: Math.min(1, 3 * actor.radius),
      position: actor.position,
      radius: 0.6,
    }
  }
  if (actor.kind === 'ring-fire-explosion') {
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: 1,
      position: actor.position,
      radius: Math.fround(2 * Math.max(0, pointGain)),
    }
  }
  if (actor.kind === 'ring-fire-fragment') {
    return {
      castsDirectionalShadow: false,
      intensity: Math.fround(Math.min(actor.alpha, 1) * 0.25),
      position: actor.position,
      radius: Math.fround(1 - nativeRandomFloatFromSemanticWord(
        presentationRandomWord(actor.id, Math.floor(presentationFrame) ^ 0x6ac690c5),
        0.25,
      )),
    }
  }
  if (
    actor.kind === 'shockwave'
    || actor.kind === 'mindblast-shockwave'
    || actor.kind === 'freeze-wave'
  ) {
    return {
      castsDirectionalShadow: false,
      intensity: actor.alpha,
      position: actor.position,
      radius: actor.radius / 140,
    }
  }
  if (actor.kind === 'storm-cloud' || actor.kind === 'acid-rain') {
    return {
      castsDirectionalShadow: false,
      intensity: actor.alpha * 0.5,
      position: actor.position,
      radius: 2,
    }
  }
  if (actor.kind === 'leviathan') {
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: 1,
      position: actor.position,
      radius: 1,
    }
  }
  if (actor.kind === 'ether-bolt') {
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: 1,
      position: actor.position,
      radius: 0.5,
    }
  }
  if (actor.kind === 'golem') {
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: 0.75,
      position: actor.position,
      radius: 1,
    }
  }
  if (actor.kind === 'magic-trap') {
    return {
      castsDirectionalShadow: false,
      intensity: 1,
      position: actor.position,
      radius: 0.25,
    }
  }
  if (actor.kind === 'ether-drain') {
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: Math.min(actor.scale, 1) * (
        0.5 + presentationRandom(actor.id * 131 + presentationFrame) * 0.5
      ),
      position: actor.position,
      radius: 2,
    }
  }
  if (actor.kind === 'ether-fade' && actor.variant === 1) {
    let intensity = Math.fround(actor.alpha)
    for (let tick = 0; tick <= Math.floor(actor.ageTicks); tick += 1) {
      intensity = Math.fround(intensity - Math.fround(actor.slowFactor))
    }
    return {
      castsDirectionalShadow: multipleShadows,
      intensity: Math.min(1, Math.max(0, intensity)),
      position: actor.position,
      radius: actor.scale,
    }
  }
  if (actor.kind !== 'comet') return null
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: 0.5,
    position: actor.position,
    radius: 2,
  }
}

export function nativeSecondaryMiscLightSource(
  actor: NativeSecondaryActorState,
): NativeBoneyardLightSource | null {
  if (actor.kind === 'magic-circle' && actor.ageTicks < 1_500) {
    return {
      castsDirectionalShadow: true,
      intensity: actor.alpha,
      position: actor.position,
      radius: actor.scale * 0.5,
    }
  }
  if (actor.kind === 'fire-burn' && actor.ageTicks > 0) {
    return {
      castsDirectionalShadow: false,
      intensity: actor.alpha,
      position: actor.position,
      radius: actor.radius,
    }
  }
  if (actor.kind === 'ether-burn' && actor.ageTicks > 0) {
    return {
      castsDirectionalShadow: false,
      intensity: actor.alpha,
      position: actor.position,
      radius: actor.radius,
    }
  }
  if (actor.kind !== 'electric-burn' || actor.ageTicks === 0) return null
  return {
    castsDirectionalShadow: false,
    intensity: actor.alpha,
    position: actor.position,
    radius: actor.radius,
  }
}

export function nativeAcceptedBoneyardLightSources(
  candidates: readonly NativeBoneyardLightSource[],
  accepted: NativeBoneyardLightSource[],
): readonly NativeBoneyardLightSource[] {
  accepted.length = 0
  for (const candidate of candidates) {
    const contained = !candidate.castsDirectionalShadow
      && nativeLightCandidateContained(candidate, accepted)
    if (!contained) accepted.push(candidate)
  }
  return accepted
}

export function nativeBoneyardLightScalar(
  position: Vec2,
  sources: NativeBoneyardLightSamples,
): number {
  if (isNativeBoneyardLightLookup(sources)) {
    return sources.scalarAt(position)
  }
  return nativeBoneyardLightScalarFromSources(position, sources)
}

export function nativeBoneyardSurfaceLightScalar(
  position: Vec2,
  sources: NativeBoneyardLightSamples,
): number {
  let radialMaximum = 0
  let elevatedMaximum = 0
  if (isNativeBoneyardLightLookup(sources)) {
    for (const sourceIndex of sources.sourceIndicesAt(position)) {
      include(sources.acceptedSources[sourceIndex]!)
    }
  } else {
    for (const source of sources) include(source)
  }
  return radialMaximum * elevatedMaximum

  function include(source: NativeBoneyardLightSample): void {
    const contribution = nativeBoneyardLightContribution(position, source)
    radialMaximum = Math.max(radialMaximum, contribution)
    const verticalGap = position.y - source.position.y
    const heightScalar = verticalGap > 0
      ? Math.max(0, 1 - verticalGap * 1.5 / NATIVE_LIGHT_OUTER_DISTANCE)
      : 1
    elevatedMaximum = Math.max(
      elevatedMaximum,
      contribution * heightScalar,
    )
  }
}

function nativeBoneyardLightScalarFromSources(
  position: Vec2,
  sources: readonly NativeBoneyardLightSample[],
): number {
  let scalar = 0
  for (const source of sources) {
    scalar = Math.max(scalar, nativeBoneyardLightContribution(position, source))
  }
  return scalar
}

export function nativeBoneyardLightTint(scalar: number): number {
  const lane = Math.trunc(Math.max(0, Math.min(1, scalar)) * 255)
  return lane * 0x010101
}

export function nativeSolomonSetPieceLighting(
  digPosition: Vec2,
  lanternPosition: Vec2,
  sources: NativeBoneyardLightSamples,
): NativeSolomonSetPieceLighting {
  return {
    digRootTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(digPosition, sources),
    ),
    dirtTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(nativeSolomonDirtOrigin(digPosition), sources),
    ),
    lanternTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(lanternPosition, sources),
    ),
  }
}

export function nativeRegionLightStamp(
  source: NativeBoneyardLightSample & { rasterScale?: number },
  screenPosition: Vec2,
  sprite: Pick<SpriteRef, 'anchorX' | 'anchorY' | 'h' | 'w'>,
  zoom: number,
): {
  alpha: number
  anchorX: number
  anchorY: number
  scale: number
  x: number
  y: number
} {
  return {
    alpha: source.intensity,
    anchorX: sprite.anchorX / sprite.w,
    anchorY: sprite.anchorY / sprite.h,
    scale: (source.rasterScale ?? source.radius) * zoom,
    x: screenPosition.x,
    y: screenPosition.y,
  }
}

function presentationRandom(frame: number, salt = 0, maximum = 1): number {
  return nativeRandomFloatFromSemanticWord(
    presentationRandomWord(frame, salt),
    maximum,
  )
}

function presentationRandomInt(
  frame: number,
  salt: number,
  exclusiveBound: number,
): number {
  return nativeRandomIntFromSemanticWord(
    presentationRandomWord(frame, salt),
    exclusiveBound,
  )
}

function presentationRandomWord(frame: number, salt = 0): number {
  let value = (Math.trunc(frame) ^ Math.trunc(salt) ^ 0x9e3779b9) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return (value ^ (value >>> 15)) >>> 0
}

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}

export function nativeBoneyardLightVisibleInManager(
  source: NativeBoneyardLightSource,
  view: NativeBoneyardLightManagerView,
  quality = NATIVE_DEFAULT_LIGHT_QUALITY,
): boolean {
  const submitted = nativeSubmittedBoneyardLightSource(source)
  const topLeftX = Math.fround(
    view.camera.x - view.viewport.width / (2 * view.camera.zoom),
  )
  const topLeftY = Math.fround(
    view.camera.y - view.viewport.height / (2 * view.camera.zoom),
  )
  const queryX = Math.fround(Math.fround(submitted.position.x) - topLeftX)
  const queryY = Math.fround(Math.fround(submitted.position.y) - topLeftY)
  const managerScale = Math.fround(Math.fround(quality) * Math.fround(0.8))
  const centerX = Math.fround(queryX * managerScale)
  const centerY = Math.fround(queryY * managerScale)
  const targetSide = Math.fround(
    Math.max(view.viewport.width, view.viewport.height) * Math.fround(quality),
  )
  const targetHeight = Math.fround(
    targetSide + Math.fround(Math.fround(quality) * Math.fround(350)),
  )
  const reach = Math.fround(
    Math.fround(Math.fround(submitted.radius) * Math.fround(NATIVE_LIGHT_OUTER_DISTANCE))
    * managerScale,
  )
  const nearestX = Math.max(0, Math.min(targetSide, centerX))
  const nearestY = Math.max(0, Math.min(targetHeight, centerY))
  const dx = Math.fround(centerX - nearestX)
  const dy = Math.fround(centerY - nearestY)
  return Math.fround(dx * dx + dy * dy) < Math.fround(reach * reach)
}

function nativeFireProjectileLightSource(
  projectile: Pick<BoneyardEnemyProjectileSnapshot, 'id' | 'position'>,
  presentationFrame: number,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: false,
    intensity: 0.85,
    position: { ...projectile.position },
    radius: Math.fround(
      Math.fround(0.5)
      + presentationRandom(presentationFrame, projectile.id ^ 0x5e6140, 0.25),
    ),
  }
}

function nativeSubmittedBoneyardLightSource(
  source: NativeBoneyardLightSource,
): NativeBoneyardLightSource {
  const intensity = Math.fround(source.intensity)
  const x = Math.fround(source.position.x)
  const y = Math.fround(source.position.y)
  const radius = Math.fround(source.radius)
  const rasterScale = source.rasterScale === undefined
    ? undefined
    : Math.fround(source.rasterScale)
  if (
    Object.is(intensity, source.intensity)
    && Object.is(x, source.position.x)
    && Object.is(y, source.position.y)
    && Object.is(radius, source.radius)
    && (
      rasterScale === undefined
        ? source.rasterScale === undefined
        : Object.is(rasterScale, source.rasterScale)
    )
  ) return source
  return {
    castsDirectionalShadow: source.castsDirectionalShadow,
    intensity,
    position: { x, y },
    radius,
    ...(rasterScale === undefined ? {} : { rasterScale }),
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled native Boneyard light member: ${String(value)}`)
}

function isNativeBoneyardLightLookup(
  value: NativeBoneyardLightSamples,
): value is NativeBoneyardLightLookup {
  return !Array.isArray(value) && 'scalarAt' in value
}

function nativeLightGridCoordinate(value: number): number {
  return Math.trunc(Math.fround(
    Math.fround(value) / Math.fround(NATIVE_LIGHT_GRID_CELL_SIZE),
  ))
}

function nativeLightGridInteriorCellCount(extent: number): number {
  return Math.ceil(Math.fround(
    Math.fround(extent) / Math.fround(NATIVE_LIGHT_GRID_CELL_SIZE),
  ))
}

function clampNativeLightGridCoordinate(value: number, maximum: number): number {
  return Math.max(-2, Math.min(maximum, value))
}

function nativeLightCandidateContained(
  candidate: NativeBoneyardLightSource,
  existingSources: readonly NativeBoneyardLightSource[],
): boolean {
  return existingSources.some((existing) => (
    nativeLightContainsCandidate(existing, candidate)
  ))
}

function nativeLightContainsCandidate(
  existing: NativeBoneyardLightSource,
  candidate: NativeBoneyardLightSource,
): boolean {
  if (
    existing.intensity < candidate.intensity
    || existing.radius < candidate.radius
  ) return false
  const dx = existing.position.x - candidate.position.x
  const dy = existing.position.y - candidate.position.y
  const containmentRadius = (
    (existing.radius - candidate.radius) * NATIVE_LIGHT_OUTER_DISTANCE
  )
  return dx * dx + dy * dy < containmentRadius * containmentRadius
}

function nativeBoneyardLightContribution(
  position: Vec2,
  source: NativeBoneyardLightSample,
): number {
  return nativeBoneyardRadialLightContribution(position, source)
}
