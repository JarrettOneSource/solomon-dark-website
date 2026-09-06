import { nativeRegionPointGain } from '../core-kernels/native-region-point-gain.ts'
import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import { nativePrimaryViewBounds } from '../core-kernels/primary-spell-targeting.ts'
import {
  boneyardBodyCollides,
  firstBoneyardLineObstruction,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import type { BoneyardEnemyProjectileWorldBlocked } from './enemies/model.ts'

export interface BoneyardProjectileViewport {
  readonly position: Readonly<BoneyardPoint>
  readonly viewportHeight: number
  readonly viewportWidth: number
}

export function createBoneyardProjectileWorld(
  bounds: BoneyardBounds,
  collision: BoneyardCollisionWorld,
  viewports: readonly BoneyardProjectileViewport[],
): BoneyardEnemyProjectileWorldBlocked {
  const views = viewports.map(viewport => nativePrimaryViewBounds({
    bounds,
    focus: viewport.position,
    padding: 0,
    scale: Math.max(1, viewport.viewportHeight / 800),
    viewportHeight: viewport.viewportHeight,
    viewportWidth: viewport.viewportWidth,
  }))
  return query => {
    switch (query.kind) {
      case 'line': return firstBoneyardLineObstruction(
        query.start, query.end, bounds, collision, undefined, query.nativeExclusionMask,
      ) !== null
      case 'point': return boneyardBodyCollides(query.position, collision, query.radius)
      case 'bounds': return !containsPoint(bounds, query.position, query.margin)
      case 'view': return !views.some(view => containsPoint(view, query.position, query.margin))
    }
  }
}

function containsPoint(bounds: BoneyardBounds, point: Readonly<BoneyardPoint>, margin: number): boolean {
  return point.x >= bounds.x - margin
    && point.y >= bounds.y - margin
    && point.x < bounds.x + bounds.w + margin
    && point.y < bounds.y + bounds.h + margin
}

export function boneyardProjectilePointGain(
  bounds: BoneyardBounds,
  viewport: BoneyardProjectileViewport,
  position: Readonly<BoneyardPoint>,
  alternatePlayer: boolean,
): number {
  const view = nativePrimaryViewBounds({
    bounds, focus: viewport.position, padding: 0,
    scale: Math.max(1, viewport.viewportHeight / 800),
    viewportHeight: viewport.viewportHeight, viewportWidth: viewport.viewportWidth,
  })
  return nativeRegionPointGain(position, { x: view.x + view.w / 2, y: view.y + view.h / 2 }, view.w, alternatePlayer)
}
