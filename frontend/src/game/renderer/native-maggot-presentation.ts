import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import { boneyardResidentIsVisible } from './boneyard-render-contract.ts'
import {
  nativeEnemyFacingBucket,
  type NativeEnemySpriteLayer,
} from './native-enemy-presentation.ts'

export interface NativeMaggotPresentationPlan {
  readonly layers: readonly NativeEnemySpriteLayer[]
}

export interface NativeMaggotArtRecord {
  readonly anchorX: number
  readonly anchorY: number
  readonly height: number
  readonly width: number
}

export function nativeMaggotPresentationPlan(
  maggot: BoneyardMaggotSnapshot,
): NativeMaggotPresentationPlan {
  const record = maggotRecord(maggot)
  const alpha = boundedUnit(maggot.alpha)
  const body: NativeEnemySpriteLayer = {
    alpha,
    atlas: record.atlas,
    blendMode: 'normal',
    entry: record.entry,
    offset: { x: 0, y: maggot.verticalOffset },
    role: maggot.state === 'emerging'
      ? `maggot-body-emerging-${maggot.launchTrajectory}`
      : 'maggot-body',
    rotationRadians: 0,
    scale: maggot.visualScale,
    tint: 0xffffff,
  }
  const hitFlash = boundedUnit(maggot.hitFlash)
  return {
    layers: hitFlash === 0 || alpha === 0
      ? [body]
      : [
          body,
          {
            ...body,
            alpha: alpha * hitFlash,
            blendMode: 'normal',
            role: 'hit:maggot-body',
            tint: 0xff0000,
          },
        ],
  }
}

export function nativeMaggotVisualBounds(
  maggot: BoneyardMaggotSnapshot,
  resolveArt: (
    atlas: NativeEnemySpriteLayer['atlas'],
    entry: number,
  ) => NativeMaggotArtRecord,
  plan = nativeMaggotPresentationPlan(maggot),
): BoneyardBounds {
  const layer = plan.layers[0]!
  const art = resolveArt(layer.atlas, layer.entry)
  return {
    h: art.height * layer.scale,
    w: art.width * layer.scale,
    x: maggot.position.x + layer.offset.x - art.anchorX * layer.scale,
    y: maggot.position.y + layer.offset.y - art.anchorY * layer.scale,
  }
}

export function nativeMaggotIsVisible(
  maggot: BoneyardMaggotSnapshot,
  visibleBounds: Readonly<BoneyardBounds>,
  resolveArt: (
    atlas: NativeEnemySpriteLayer['atlas'],
    entry: number,
  ) => NativeMaggotArtRecord,
  plan = nativeMaggotPresentationPlan(maggot),
): boolean {
  return boneyardResidentIsVisible(
    nativeMaggotVisualBounds(maggot, resolveArt, plan),
    visibleBounds,
  )
}

function maggotRecord(maggot: BoneyardMaggotSnapshot): {
  atlas: 'BadGuys' | 'DeadHawg'
  entry: number
} {
  if (maggot.state === 'death') return { atlas: 'DeadHawg', entry: 28 }
  if (maggot.state === 'emerging') {
    const phase = Math.min(4, Math.max(0, Math.floor(maggot.emergencePhase)))
    const orientation = Math.min(9, Math.max(0, Math.floor(
      maggot.emergenceOrientation,
    )))
    return { atlas: 'BadGuys', entry: 2013 + phase * 10 + orientation }
  }
  const pose = maggot.state === 'bite' ? 1 : Math.min(1, Math.floor(maggot.pose))
  return {
    atlas: 'BadGuys',
    entry: 202 + pose * 18 + nativeEnemyFacingBucket('SKELETON', maggot.headingDeg),
  }
}

function boundedUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
