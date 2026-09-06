import type { NativeBossSpell } from '../../core-kernels/native-boss-spell.ts'
import { createBossSpellOwner } from './boss-spell-construction.ts'
import { spawnBouncer, spawnSimpleDeathEffect } from './death-effects.ts'
import { UNHOLY_GREEN } from './demon-skull-effects.ts'
import { emitEvent } from './events.ts'
import type { BoneyardEnemyStoreStepContext, WorkingStep } from './model.ts'
import { drawEnemyFloat, drawEnemyInteger, radialVector, randomEnemyOffset } from './random.ts'

type UltraSpell = Extract<NativeBossSpell, { kind: 'ultra-banish' | 'unholy-soul' }>

export function stepUltraBanishSpell(work: WorkingStep, source: UltraSpell,
  context: BoneyardEnemyStoreStepContext, population: readonly NativeBossSpell[]): UltraSpell | null {
  const ageTicks = source.ageTicks + 1
  if (source.kind === 'unholy-soul') {
    let scale = Math.min(1, Math.fround(source.scale + Math.fround(.01)))
    let angleDeg = Math.fround(source.angleDeg - source.angularSpeed)
    const height = Math.fround(source.height - source.verticalSpeed)
    let life = Math.fround(source.life - Math.fround(.01))
    drawEnemyFloat(work, 1)
    if (source.fast) {
      drawEnemyFloat(work, 2)
      angleDeg = Math.fround(angleDeg - source.angularSpeed)
    }
    if (angleDeg < 0) angleDeg = Math.fround(angleDeg + 360)
    if (life <= 0) return null
    const angle = angleDeg * Math.PI / 180
    const position = { x: Math.fround(source.origin.x + Math.sin(angle) * 100),
      y: Math.fround(source.origin.y - Math.cos(angle) * 100) }
    let angularSpeed = source.angularSpeed
    let verticalSpeed = source.verticalSpeed
    if (!population.some(spell => spell.kind === 'ultra-banish' && spell.remainingTicks > 100)) {
      life = Math.fround(Math.min(life, Math.fround(1.1)) - Math.fround(.01))
      angularSpeed = Math.fround(angularSpeed * Math.fround(1.05))
      verticalSpeed = Math.fround(verticalSpeed * Math.fround(1.05))
    }
    return { ...source, ageTicks, scale, angleDeg, height, life, position, angularSpeed, verticalSpeed }
  }
  const lightRadius = Math.fround(1 + drawEnemyFloat(work, 1))
  emitEvent(work, context.tick, 'enemy-camera-shake', source.ownerActorId, { sourcePosition: source.position,
    cameraShake: { attenuation: 'fixed', displacement: randomEnemyOffset(work, 15) } })
  if (source.remainingTicks % 25 === 0 || drawEnemyInteger(work, 40) === 3) {
    emitEvent(work, context.tick, 'enemy-screen-flash', source.ownerActorId, { sourcePosition: source.position,
      screenFlashOnlyIfClear: true, screenFlash: { red: .25, green: 1, blue: .25,
        alpha: source.alpha * .5, decayPerTick: Math.fround(.1), pointAttenuated: false } })
    spawnSimpleDeathEffect(work, { id: source.ownerActorId, position: source.position }, context.tick,
      { alpha: 1, opacityTimer: 3, alphaLossPerTick: Math.fround(.005), atlas: 'DeadHawg', entry: 16,
        blendMode: 'add', kind: 'fade-scale-perspective', lifetimeTicks: 1000, presentationOwner: 'pre-world-queue',
        role: 'ultra-banish-ring', scale: 2, scaleMultiplier: Math.fround(1.045 + drawEnemyFloat(work, Math.fround(.025))),
        tint: UNHOLY_GREEN })
    if (source.remainingTicks > 100 && drawEnemyInteger(work, 2) === 1 && source.megaDeath) {
      const angleDeg = drawEnemyFloat(work, 360)
      const angularSpeed = Math.fround(3 + drawEnemyFloat(work, 3))
      const verticalSpeed = Math.fround((2 + drawEnemyFloat(work, 3)) * 1.25)
      work.bossSpells.push({ ...createBossSpellOwner(work, source.ownerActorId, context.tick, 0, 'unholy-soul'),
        position: { x: 0, y: 0 }, origin: source.position, angleDeg, angularSpeed, height: 0,
        verticalSpeed, scale: 0, life: 10, fast: drawEnemyInteger(work, 50) === 1 })
    }
  }
  const remainingTicks = source.remainingTicks - 1
  const alpha = remainingTicks <= 100 ? Math.fround(source.alpha - Math.fround(.01)) : source.alpha
  if (alpha <= 0) return null
  if (source.megaDeath && remainingTicks > 100) {
    spawnBouncer(work, { id: source.ownerActorId, position: source.position }, context.tick,
      () => 1819 + drawEnemyInteger(work, 4), 'ultra-banish-bone', () => {
        const speed = Math.fround(2 + drawEnemyFloat(work, .25))
        const heading = drawEnemyFloat(work, 360)
        const velocity = radialVector(heading, speed * (drawEnemyInteger(work, 20) === 3 ? 1.5 : 1))
        return { bounceVelocityMultiplier: 4, opacityTimer: 20, presentationOwner: 'background', velocity }
      })
  }
  let flashAlpha = Math.max(0, Math.fround(source.flashAlpha - Math.fround(.05)))
  if (flashAlpha <= 0 && drawEnemyInteger(work, 1000) === 3) flashAlpha = 1
  return { ...source, ageTicks, remainingTicks, alpha, flashAlpha, lightRadius }
}
