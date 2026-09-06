import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { createNativeRainCloudBillow, type NativeRainCloudBillow } from '../core-kernels/native-faculty-spells.ts'
import { createNativeRng, type NativeRngState } from '../core-kernels/native-rng.ts'
import { layer } from './native-enemy-layers.ts'
import type { NativeEnemySpriteLayer } from './native-enemy-presentation-model.ts'

type Rain = Extract<NativeBossSpell, { kind: 'rain-of-bones' }>
type Billow = NativeRainCloudBillow & { phaseDeg: number }

/** Rain's private manager ticks during painting; its children do not belong to the world actor clock. */
export class NativeRainCloud {
  private readonly billows: Billow[] = []
  private lastBirthTick: number
  private rng: NativeRngState

  constructor(spell: Rain, presentationTick: number) {
    this.lastBirthTick = spell.ageTicks <= 1 ? spell.spawnTick : Math.floor(presentationTick)
    this.rng = createNativeRng(spell.id)
  }

  update(spell: Rain, presentationTick: number): readonly NativeEnemySpriteLayer[] {
    if (spell.alpha <= 0) return []
    const now = Math.floor(presentationTick)
    const through = Math.min(now, spell.spawnTick + 1199)
    for (let tick = Math.max(this.lastBirthTick + 1, spell.spawnTick + 20); tick <= through; tick += 1) {
      for (let index = 0; index < 2; index += 1) {
        const birth = createNativeRainCloudBillow(spell.position, this.rng)
        this.rng = birth.rng
        this.billows.push({ ...birth.billow, phaseDeg: 0 })
      }
    }
    this.lastBirthTick = now
    const layers: NativeEnemySpriteLayer[] = []
    for (let index = this.billows.length - 1; index >= 0; index -= 1) {
      const billow = this.billows[index]!
      billow.phaseDeg = Math.fround(billow.phaseDeg + billow.phaseStepDeg)
      if (billow.phaseDeg >= 180) this.billows.splice(index, 1)
    }
    for (const [index, billow] of this.billows.entries()) {
      layers.push(layer('BadGuys', billow.entry, `acid-pain-cloud-billow-${index}`, {
        alpha: Math.fround(Math.sin(billow.phaseDeg * Math.PI / 180)),
        offset: { x: billow.position.x - spell.position.x, y: billow.position.y - spell.position.y - 175 },
        rotationRadians: billow.rotationDeg * Math.PI / 180, scale: billow.scale, tint: billow.tint,
      }))
    }
    return layers
  }
}
