import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { roundHalfToEven } from '../core-kernels/native-rounding.ts'
import { nativeDeathMagicLayers } from './native-death-magic-presentation.ts'
import { layer } from './native-enemy-layers.ts'
import type { NativeEnemySpriteLayer } from './native-enemy-presentation-model.ts'
import { nativeUltraBanishPlan } from './native-ultra-banish-presentation.ts'

export function nativeBossSpellLayers(spell: NativeBossSpell, tick: number): readonly NativeEnemySpriteLayer[] {
  switch (spell.kind) {
    case 'ultra-banish': return nativeUltraBanishPlan(spell, tick, 900).layers
    case 'unholy-soul': return [layer('Unholy', 3, 'unholy-soul', { alpha: Math.min(1, spell.life), blendMode: 'add',
      offset: { x: 0, y: spell.height }, rotationRadians: (spell.angleDeg - 90) * Math.PI / 180, scale: spell.scale })]
    case 'mouth-beam-segment': {
      const gate = drawNativeInteger(createNativeRng(spell.id + Math.trunc(tick)), 8)
      if (gate.value !== 1) return []
      const size = drawNativeFloat(gate.state, Math.fround(.22))
      const radius = drawNativeFloat(size.state, 50)
      const angle = drawNativeFloat(radius.state, 360).value * Math.PI / 180
      return [layer('Unholy', 0, 'mouth-beam-spark', { tint: 0x8cff0c,
        offset: { x: Math.sin(angle) * radius.value, y: -Math.cos(angle) * radius.value }, scale: (.25 - size.value) * 2 })]
    }
    case 'unholy-burst': {
      const frame = roundHalfToEven(spell.framePhase)
      return frame >= 14 ? [] : [layer('BadGuys', 420 + frame, 'unholy-impact-rise', {
        blendMode: 'add', offset: { x: 0, y: spell.offsetY }, scale: 3, tint: 0x8cff0c })]
    }
    case 'green-fire': {
      const fire = spell.fire
      const phase = roundHalfToEven(fire.atlasPhase)
      const scale = fire.fadeAlpha * fire.scale * 1.100000023841858
      return phase >= 32 ? [] : [layer('Unholy', 9 + phase, 'green-fire', { alpha: Math.min(1, fire.drawAlpha * fire.life),
        blendMode: 'add', offset: { x: 0, y: -10 }, scale, scaleX: scale * fire.horizontalSign, tint: 0x8cff0c })]
    }
    case 'eye-laser': {
      const unused = drawNativeFloat(createNativeRng(spell.id + Math.trunc(tick)), .25, true)
      const size = drawNativeFloat(unused.state, Math.fround(.15), true)
      const glowSize = drawNativeFloat(size.state, Math.fround(.15), true)
      return [layer('Unholy', 1, 'eye-laser', { blendMode: 'add', rotationRadians: spell.phaseDeg * Math.PI / 180,
        scale: (Math.fround(.35) + size.value) * 2, tint: 0x8cff0c }),
      layer('Unholy', 2, 'eye-laser-glow', { alpha: Math.fround(.65), blendMode: 'add', scale: (.5 + glowSize.value) * 2, tint: 0x8cff0c })]
    }
    case 'unholy-spit': {
      let rng = createNativeRng(spell.id + Math.trunc(tick))
      const offset = { x: 0, y: -Math.sin(spell.progress * Math.PI) * spell.height }
      const layers: NativeEnemySpriteLayer[] = []
      for (const [index, scale] of [3, 3, 2].entries()) {
        const draw = drawNativeInteger(rng, 4)
        rng = draw.state
        layers.push(layer('Unholy', 5 + draw.value, `unholy-spit-${index}`,
          { blendMode: index === 0 ? 'normal' : 'add', offset, scale }))
      }
      layers.push(layer('Unholy', 2, 'unholy-spit-glow', { blendMode: 'add', offset,
        scale: (1 + drawNativeFloat(rng, 1).value) * 2, tint: 0x8cff0c }))
      return layers
    }

    case 'heartmonger-flicker': {
      const jitter = drawNativeFloat(createNativeRng(spell.id + Math.trunc(tick)), .30000007152557373).value
      const scale = Math.sin(spell.phaseDeg * Math.PI / 180) * 5 * (.8999999761581421 + jitter)
      return [layer('BadGuys', 15, 'heartmonger-flicker', { scale, scaleY: scale * .800000011920929 })]
    }
    case 'heartmonger-soul': {
      const alpha = Math.sin(spell.lifePhaseDeg * Math.PI / 180)
      const y = Math.sin(spell.bobPhaseDeg * Math.PI / 180) * 5 - spell.lifePhaseDeg * .5 - 50
      return [0, 1].map(index => layer('Heartmonger', 0, `heartmonger-soul-${index}`, {
        alpha, blendMode: 'add', offset: { x: 0, y }, scale: 1.600000023841858,
        scaleX: (alpha * .25 + .75) * 1.600000023841858,
      }))
    }
    case 'blightning': return []
    case 'death-magic': return nativeDeathMagicLayers({ x: 0, y: 0 }, spell.scale, tick,
      createNativeRng(spell.id + Math.trunc(tick))).layers.map((layer) => ({ ...layer,
        alpha: Math.min(1, layer.alpha * spell.alpha) }))
    case 'skull-missile': return nativeDeathMagicLayers({ x: 0, y: 0 }, 1.25, spell.phaseDeg,
      createNativeRng(spell.id + Math.trunc(tick))).layers.map((layer) => ({ ...layer,
        alpha: layer.alpha * Math.min(spell.remainingTicks / 100, 1) }))
    case 'dark-fireball': {
      const height = -15 - (spell.arcPhaseStep > 0 ? Math.sin(spell.arcPhase * Math.PI / 180) * 50 : 0)
      const size = drawNativeFloat(createNativeRng(spell.id + Math.trunc(tick)), .25, true).value
      const alpha = Math.min(spell.remainingTicks / 100, 1)
      return [layer('BadGuys', 15, 'direball-glow', { alpha: alpha * .5, offset: { x: 0, y: height },
        scale: 2, tint: 0xff0d00 }),
      layer('BadGuys', 255 + spell.ageTicks % 12, 'direball-flame', { alpha, offset: { x: 0, y: height },
        rotationRadians: (spell.headingDeg + 180) * Math.PI / 180, scale: 1.25 + size, tint: 0xff8000 })]
    }
    case 'rain-of-bones': return [
      layer('BadGuys', 78, 'acid-pain-cloud', { alpha: spell.alpha * .4000000059604645,
        offset: { x: 0, y: -175 }, rotationRadians: spell.phase * .03125 * spell.rotationSign * Math.PI / 180,
        scale: spell.scale * 5, scaleY: spell.scale * 4,
        tint: Math.round((Math.sin(spell.phase * Math.PI / 180) * .10000000149011612 + .20000000298023224) * 255) << 16 }),
      layer('BadGuys', 1, 'acid-pain-cloud-glow', { alpha: spell.alpha * .75, offset: { x: 0, y: -175 },
        rotationRadians: spell.phase * -.5 * Math.PI / 180, scale: spell.scale * 6,
        scaleY: spell.scale * 6 * .800000011920929, tint: 0x732626 }),
    ]
    case 'falling-bone': {
      const channel = Math.round(spell.colorRamp * 255)
      return [layer('BadGuys', spell.entry, 'acid-pain-falling-bone', {
        offset: { x: 0, y: spell.height }, rotationRadians: spell.rotationDeg * Math.PI / 180,
        scale: 1.2000000476837158, tint: channel * 0x010101 })]
    }
    case 'tragic-circle': return []
    case 'dire-fire': {
      const alpha = Math.min(spell.alpha, 1)
      const scale = spell.ramp * spell.scale * 1.100000023841858
      const ground = spell.glow ? [
        layer('BadGuys', 10, 'dire-fire-ground', { alpha, rotationRadians: spell.rotationSigns[0] * spell.rotationPhases[0] * Math.PI / 180,
          scale: spell.scale * 1.5, scaleY: spell.scale * 1.5 * .800000011920929, tint: 0 }),
        layer('BadGuys', 11, 'dire-fire-red-ground', { alpha, rotationRadians: -spell.rotationSigns[1] * spell.rotationPhases[1] * Math.PI / 180,
          scale: spell.scale * 2, scaleY: spell.scale * 2 * .800000011920929, tint: 0x1a0000 }),
      ] : []
      return [...ground, layer('DeadHawg', 46 + Math.trunc(spell.phase) % 32, 'dire-fire-flame', {
        alpha: Math.min(spell.alpha, 1), blendMode: 'add', offset: { x: 0, y: -10 },
        scale, scaleX: scale * spell.scaleSign, tint: 0x400000 })]
    }
  }
}
