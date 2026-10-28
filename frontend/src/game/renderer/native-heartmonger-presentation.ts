import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { layer, presentation, requiredPoint } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamilyPresentation, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'

export function heartmongerPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const legs = 200 + Math.trunc(animation?.gaitPose ?? 0) * 18 + facing
  const torso = 146 + Math.trunc(animation?.bodyPose ?? 0) * 18 + facing
  const head = 110 + (animation?.headVariant ?? 0) * 18 + facing
  const torsoPoint = requiredPoint(authoredPoints('Heartmonger', legs), 2, 'Heartmonger legs')
  const headPoint = requiredPoint(authoredPoints('Heartmonger', torso), 0, 'Heartmonger torso')
  // Retail attachments are root-relative world offsets, independent of the art scale.
  const torsoOffset = { x: torsoPoint.x / enemy.scale, y: torsoPoint.y / enemy.scale }
  const headOffset = { x: (torsoPoint.x + headPoint.x) / enemy.scale,
    y: (torsoPoint.y + headPoint.y) / enemy.scale }
  return presentation([
    layer('Heartmonger', legs, 'heartmonger-legs', { scale: 1.0499999523162842 }),
    layer('Heartmonger', torso, 'heartmonger-torso', { offset: torsoOffset, scale: 1.0499999523162842 }),
    layer('Heartmonger', head, 'heartmonger-head', { offset: headOffset,
      scale: 1.3300000429153442 * 1.0499999523162842 }),
  ])
}
