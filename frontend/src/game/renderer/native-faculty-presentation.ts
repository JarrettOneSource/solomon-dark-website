import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { nativeDeathMagicLayers } from './native-death-magic-presentation.ts'
import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { layer, presentation, requiredPoint } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamilyPresentation, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'

export function facultyPresentation(enemy: NativeEnemyVisualSnapshot, facing: number,
  animation: NativeEnemyAnimationSample | undefined, tick: number,
  authoredPoints: NativeEnemyAuthoredPointResolver): NativeEnemyFamilyPresentation {
  const faculty = enemy.faculty
  if (faculty === undefined) throw new Error('Faculty appearance and clock are required')
  const pose = Math.trunc(animation?.bodyPose ?? 0)
  const robePose = pose > 0 ? 4 + pose : Math.trunc(animation?.gaitPose ?? 0)
  const bodyEntry = 1 + pose * 18 + facing
  const bob = (Math.sin(faculty.lightPhase * Math.PI / 180) * 8 - 15) / enemy.scale
  const jitter = Math.sin(faculty.lightPhase * 16 * Math.PI / 180) * .5 / enemy.scale
  const angle = enemy.headingDeg * Math.PI / 180
  const robeOffset = { x: Math.sin(angle) * jitter, y: bob - Math.cos(angle) * jitter }
  const bodyTint = tint(faculty.bodyColor)
  const headTint = tint(faculty.headColor)
  const layers = [
    layer('Faculty', bodyEntry, 'faculty-body', { offset: { x: 0, y: bob }, scale: 1.0499999523162842 }),
    layer('Faculty', 199 + robePose * 18 + facing, 'faculty-robe', {
      alpha: faculty.bodyColor[3], offset: robeOffset, scale: 1.0499999523162842, tint: bodyTint }),
    layer('Faculty', 361 + robePose * 18 + facing, 'faculty-robe-trim', {
      alpha: faculty.headColor[3], offset: robeOffset, scale: 1.0499999523162842, tint: headTint }),
  ]
  let rng = createNativeRng(enemy.id + Math.trunc(tick))
  for (let hand = 0; hand < 2; hand += 1) {
    if ((faculty.handMask & (1 << hand)) === 0) continue
    const anchor = requiredPoint(authoredPoints('Faculty', bodyEntry), hand, 'Faculty hand')
    const aura = nativeDeathMagicLayers({ x: anchor.x / enemy.scale, y: anchor.y / enemy.scale + bob },
      1.5 / enemy.scale, tick, rng)
    layers.push(...aura.layers)
    rng = aura.rng
  }
  const headOffset = { x: 0, y: bob + (enemy.headgear === 0 ? -5 / enemy.scale : 0) }
  if (enemy.headgear === 0) {
    layers.push(layer('Faculty', 91 + facing, 'faculty-head-robe', {
      alpha: faculty.bodyColor[3], offset: headOffset, scale: 1.0499999523162842, tint: bodyTint }),
    layer('Faculty', 109 + facing, 'faculty-head', {
      alpha: faculty.headColor[3], offset: headOffset, scale: 1.0499999523162842, tint: headTint }))
    if (faculty.female) layers.push(layer('Faculty', 127 + facing, 'faculty-hair', {
      offset: headOffset, scale: 1.0499999523162842 }))
  } else {
    layers.push(layer('Faculty', 145 + facing, 'faculty-hat', { offset: headOffset, scale: 1.0499999523162842 }),
      layer('Faculty', 163 + facing, 'faculty-hat-robe', { alpha: faculty.bodyColor[3], offset: headOffset,
        scale: 1.0499999523162842, tint: bodyTint }),
      layer('Faculty', 181 + facing, 'faculty-hat-trim', { alpha: faculty.headColor[3], offset: headOffset,
        scale: 1.0499999523162842, tint: headTint }))
  }
  if (animation?.state !== 'death') return presentation(layers)
  const distance = drawNativeFloat(rng, animation.deathTick / 25)
  const direction = drawNativeFloat(distance.state, 360)
  const deathAngle = direction.value * Math.PI / 180
  return presentation(layers.map((source) => ({ ...source, offset: {
    x: source.offset.x + Math.sin(deathAngle) * distance.value / enemy.scale,
    y: source.offset.y - Math.cos(deathAngle) * distance.value / enemy.scale,
  } })))
}

function tint(color: readonly [number, number, number, number]): number {
  return (Math.round(color[0] * 255) << 16) | (Math.round(color[1] * 255) << 8) | Math.round(color[2] * 255)
}
