import { nativeDemonSkullBob, nativeDemonSkullEyes, nativeDemonSkullFacing } from '../core-kernels/native-demon-skull-attachments.ts'
import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { layer, presentation } from './native-enemy-layers.ts'
import type { NativeEnemyFamilyPresentation, NativeEnemySpriteLayer, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'

export function demonSkullPresentation(enemy: NativeEnemyVisualSnapshot, tick: number): NativeEnemyFamilyPresentation {
  const state = enemy.demonSkull
  if (state === undefined) throw new Error('DemonSkull visual state is required')
  let rng = createNativeRng(enemy.id + Math.trunc(tick))
  const random = (maximum: number, signed = false) => {
    const draw = drawNativeFloat(rng, maximum, signed)
    rng = draw.state
    return draw.value
  }
  const bob = nativeDemonSkullBob(state.bodyPhaseDeg)
  const offset = { x: (state.bodyOffset.x + state.jitter.x) / enemy.scale,
    y: (state.bodyOffset.y + state.jitter.y + bob) / enemy.scale }
  const pose = state.bodyPose
  const facing = nativeDemonSkullFacing(state.bodyHeadingDeg)
  const overlay = 171 + pose * 24 + facing
  const layers: NativeEnemySpriteLayer[] = []
  const frontEyes: NativeEnemySpriteLayer[] = []
  if (state.eyeCharge > 0) {
    const eyes = nativeDemonSkullEyes({ x: 0, y: 0 }, state, enemy.scale, state.bodyHeadingDeg)
    for (const [index, eye] of eyes.entries()) {
      const behind = eye.y + 45 < state.bodyOffset.y + bob
      const glow = layer('Unholy', 2, `discorporeal-eye-charge-${index}`, { alpha: state.eyeCharge,
        blendMode: behind ? 'normal' : 'add', scale: 4 / enemy.scale,
        offset: { x: eye.x / enemy.scale + offset.x, y: eye.y / enemy.scale + offset.y } })
      if (behind) layers.push(glow)
      else frontEyes.push(glow)
    }
  }
  const dying = enemy.animation?.state === 'death'
  if (dying || pose >= 2 || state.flairGlow > 0) {
    layers.push(layer('Unholy', 2, 'discorporeal-flair', {
      alpha: dying || pose >= 2 ? 1 : state.flairGlow, offset, scale: (7 + random(2)) / enemy.scale, tint: 0x8cff0c }))
    if (pose === 2) layers.push(layer('Unholy', 2, 'discorporeal-death-flair', {
      alpha: .5 + random(.5), offset, scale: (7 + random(2)) * 1.5 / enemy.scale, tint: 0x8cff0c }))
  }
  const rotationRadians = state.spin * Math.PI / 180
  layers.push(layer('Unholy', 99 + pose * 24 + facing, 'discorporeal-body', { offset, rotationRadians, scale: 2 }))
  if (pose < 2) {
    const alpha = .75 + Math.sin(state.flickerPhaseDeg * Math.PI / 180) * .25
    layers.push(layer('Unholy', overlay, 'discorporeal-body-glow', {
      alpha, blendMode: 'add', offset, rotationRadians, scale: 3.799999952316284, tint: 0xabff0d }),
    layer('Unholy', overlay, 'discorporeal-body-glow-outer', {
      alpha, blendMode: 'add', offset, rotationRadians, scale: 4 / enemy.scale, tint: 0xabff0d }))
  } else {
    const alpha = .5 + random(.5)
    layers.push(layer('Unholy', 2, 'discorporeal-death-core', { alpha, blendMode: 'add',
      offset: { x: offset.x, y: offset.y - 35 / enemy.scale }, scale: (5 + random(.25, true)) / enemy.scale, tint: 0x8cff0c }))
  }
  // Native pose-two overlay indexing reaches blank records; the actor's body remains visible.
  if (pose < 2 && state.chargeGlow > 0) {
    layers.push(layer('Unholy', overlay, 'discorporeal-charge-glow', { alpha: state.chargeGlow,
      blendMode: 'add', offset, rotationRadians, scale: (4.25 + random(.1, true)) / enemy.scale, tint: 0xabff0d }),
    layer('Unholy', overlay, 'discorporeal-charge-outer', { alpha: state.chargeGlow * .75,
      blendMode: 'add', offset, rotationRadians, scale: (4 + state.chargeGlow) / enemy.scale, tint: 0xabff0d }))
  }
  layers.push(...frontEyes)
  return presentation(layers, { hitBody: [] })
}
