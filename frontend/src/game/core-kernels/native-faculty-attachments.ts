import faculty from '../../editor/manifest/faculty.json' with { type: 'json' }
import { nativeEighteenWayFacingBucket } from './boneyard-mage-lightning.ts'
import type { BoneyardPoint } from './boneyard.ts'

/** The lightning callback reads raw hand points, without the body's 1.05 scale or bob. */
export function nativeFacultyLightningSource(root: Readonly<BoneyardPoint>, pose: number,
  headingDeg: number, handMask: number): BoneyardPoint {
  const entry = 1 + Math.trunc(pose) * 18 + nativeEighteenWayFacingBucket(headingDeg)
  const points = faculty.entries[entry]?.extras
  let x = root.x
  let y = root.y - 15
  for (let hand = 0; hand < 2; hand += 1) {
    if ((handMask & (1 << hand)) === 0) continue
    const point = points?.[hand]
    if (point === undefined) throw new Error(`Faculty:${entry} lacks hand ${hand}`)
    x = Math.fround(x + point.x)
    y = Math.fround(y + point.y)
  }
  return { x, y }
}
