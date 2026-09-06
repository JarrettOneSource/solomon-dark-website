import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { nativeFacultyColor } from '../core-kernels/native-faculty.ts'
import { drawNativeFloat, drawNativeInteger, type NativeRngState } from '../core-kernels/native-rng.ts'
import { layer } from './native-enemy-layers.ts'
import type { NativeEnemySpriteLayer } from './native-enemy-presentation-model.ts'

export function nativeDeathMagicLayers(position: Readonly<BoneyardPoint>, scale: number,
  phase: number, sourceRng: NativeRngState): { layers: readonly NativeEnemySpriteLayer[]; rng: NativeRngState } {
  let rng = sourceRng
  const layers: NativeEnemySpriteLayer[] = []
  const float = (maximum: number) => {
    const draw = drawNativeFloat(rng, maximum)
    rng = draw.state
    return draw.value
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const pulse = Math.abs(Math.sin(phase * 15 * Math.PI / 180))
    layers.push(layer('BadGuys', 110, `death-magic-outer-disk-${pass}`, {
      alpha: Math.fround(.20000000298023224 + float(.25)), offset: position,
      scale: (pulse * .15000000596046448 + 2.5) * scale, tint: 0 }))
    layers.push(layer('BadGuys', 110, `death-magic-inner-disk-${pass}`, {
      alpha: Math.fround(.3499999940395355 + float(.550000011920929)), offset: position,
      scale: (pulse * .15000000596046448 + 1.5) * scale, tint: 0 }))
    const color = nativeFacultyColor([Math.fround(.75 + float(.5)), 0, 0, 1], .5)
    const tint = (Math.round(color[0] * 255) << 16) | (Math.round(color[1] * 255) << 8) | Math.round(color[2] * 255)
    layers.push(layer('BadGuys', 111, `death-magic-center-${pass}`, {
      alpha: Math.abs(Math.sin(phase * 5 * Math.PI / 180)) * .3499999940395355,
      blendMode: 'add', offset: position,
      rotationRadians: Math.sin(phase * Math.PI / 180) * scale * 50 * Math.PI / 180,
      scale: (1 + float(.10000000149011612)) * scale, tint }))
    const count = drawNativeInteger(rng, 10)
    rng = count.state
    for (let spark = 0; spark < count.value + 2; spark += 1) {
      const alpha = float(.75)
      const distance = float(scale * 20)
      const angle = float(360) * Math.PI / 180
      const size = (.25 + float(.20000000298023224)) * scale
      const rotation = float(360) * Math.PI / 180
      layers.push(layer('BadGuys', 111, `death-magic-spark-${pass}-${spark}`, {
        alpha, blendMode: 'add', offset: {
          x: position.x + Math.sin(angle) * distance, y: position.y - Math.cos(angle) * distance },
        rotationRadians: rotation, scale: size, tint }))
    }
    layers.push(layer('BadGuys', 112, `death-magic-star-${pass}`, {
      alpha: Math.abs(Math.sin(phase * 8 * Math.PI / 180)) * .550000011920929,
      blendMode: 'add', offset: position, rotationRadians: scale * 50 * phase * Math.PI / 180,
      scale: (1 + float(.30000001192092896)) * scale, tint }))
  }
  return { layers, rng }
}
