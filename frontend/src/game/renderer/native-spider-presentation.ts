import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { layer, presentation } from './native-enemy-layers.ts'
import type { NativeEnemyFamilyPresentation } from './native-enemy-presentation-model.ts'

/** Spider::Render 0x004A1670 draws legs, proximity outline, then its independent body. */
export function nativeSpiderPresentation(
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
): NativeEnemyFamilyPresentation {
  if (!animation?.spider) throw new Error('Spider rendering requires an authoritative Spider sample')
  const pose = animation.bodyPose
  if (!Number.isInteger(pose) || pose < 0 || pose > 3) throw new Error('Spider leg pose is outside its four banks')
  const appearance = animation.spider
  const legs = layer('BadGuys', 1840 + pose * 18 + facing, 'spider-legs')
  const body = layer('BadGuys', 1912 + nativeEighteenWayFacingBucket(appearance.bodyHeadingDeg), 'spider-body')
  const outline = appearance.outlineAlpha <= 0 ? [] : [{
    ...layer('BadGuys', 1930 + pose * 18 + facing, 'spider-outline'),
    alpha: appearance.outlineAlpha, tint: appearance.outlineTint, blendMode: 'add' as const,
  }]
  return presentation([legs, ...outline, body], { hitBody: [legs, body] })
}
