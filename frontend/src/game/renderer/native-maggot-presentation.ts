import type { BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import {
  nativeEnemyFacingBucket,
  type NativeEnemySpriteLayer,
} from './native-enemy-presentation.ts'

export interface NativeMaggotPresentationPlan {
  readonly layers: readonly NativeEnemySpriteLayer[]
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
    offset: { x: 0, y: 0 },
    role: 'maggot-body',
    rotationRadians: 0,
    scale: 1,
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
            blendMode: 'add',
            role: 'maggot-body-hit-flash',
          },
        ],
  }
}

function maggotRecord(maggot: BoneyardMaggotSnapshot): {
  atlas: 'BadGuys' | 'DeadHawg'
  entry: number
} {
  if (maggot.state === 'death') return { atlas: 'DeadHawg', entry: 28 }
  const pose = maggot.state === 'bite' ? 1 : Math.min(1, Math.floor(maggot.pose))
  return {
    atlas: 'BadGuys',
    entry: 202 + pose * 18 + nativeEnemyFacingBucket('SKELETON', maggot.headingDeg),
  }
}

function boundedUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
