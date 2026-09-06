import type { NativeBoneyardLightSource } from './native-boneyard-light-model.ts'
import type { NativeBossSpell } from './native-boss-spell.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

export function nativeBossSpellLight(spell: NativeBossSpell, presentationFrame: number,
  multipleShadows: boolean): NativeBoneyardLightSource | null {
  const rng = createNativeRng(spell.id + Math.trunc(presentationFrame))
  const source = { position: spell.position, castsDirectionalShadow: multipleShadows }
  switch (spell.kind) {
    case 'ultra-banish': return { ...source, radius: spell.lightRadius, intensity: spell.alpha }
    case 'unholy-soul': return null
    case 'mouth-beam-segment': return { ...source, radius: 1, intensity: 1 }
    case 'unholy-burst': return { ...source, radius: 3, intensity: Math.min(1, spell.lightIntensity) }
    case 'eye-laser': return { ...source, radius: 1, intensity: 1 }
    case 'unholy-spit': return { ...source, radius: .5, intensity: 1 }
    case 'green-fire': return spell.glow ? { ...source, radius: Math.fround(.6), intensity: Math.min(1, spell.fire.life * 3) } : null

    case 'heartmonger-flicker': return null
    case 'heartmonger-soul': return { ...source,
      intensity: Math.max(0, Math.fround(1 - spell.ageTicks * .03999999910593033)), radius: 1 }
    case 'death-magic': return spell.light === null ? null : { ...source,
      castsDirectionalShadow: false, intensity: spell.light.intensity, radius: spell.light.radius }
    case 'blightning':
    case 'falling-bone': return null
    case 'skull-missile': return { ...source, intensity: .75,
      radius: Math.fround(.75 + drawNativeFloat(rng, Math.fround(.1), true).value) }
    case 'dark-fireball': return { ...source, castsDirectionalShadow: false, intensity: .8500000238418579,
      radius: Math.fround(.5 + drawNativeFloat(rng, .25, true).value) }
    case 'rain-of-bones': return { ...source, castsDirectionalShadow: false,
      intensity: drawNativeFloat(rng, Math.fround(spell.alpha * .5)).value, radius: 2 }
    case 'tragic-circle': return { ...source, intensity: Math.fround(.75 + drawNativeFloat(rng, .25, true).value), radius: 2 }
    case 'dire-fire': return { ...source, intensity: Math.min(spell.alpha * 3, 1), radius: .6000000238418579 }
  }
}
