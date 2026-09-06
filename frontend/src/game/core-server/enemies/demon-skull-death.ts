import { NATIVE_DEMON_SKULL_DEATH_STREAM_TICKS } from '../../core-kernels/native-demon-skull.ts'
import { createBossSpellOwner } from './boss-spell-construction.ts'
import { spawnSimpleDeathEffect } from './death-effects.ts'
import { UNHOLY_GREEN } from './demon-skull-effects.ts'
import { emitEnemyActionSound, emitEvent } from './events.ts'
import type { BoneyardDemonSkullActor, WorkingStep } from './model.ts'
import { positiveModulo } from './movement.ts'
import { drawEnemyFloat, drawEnemyInteger, radialVector, randomEnemyOffset } from './random.ts'

export function stepDyingDemonSkull(work: WorkingStep, actor: BoneyardDemonSkullActor, tick: number): BoneyardDemonSkullActor {
  const remaining = actor.brain.deathCountdown
  if (actor.deathTick === 0) {
    work.demonSkullEncounter = { ...work.demonSkullEncounter, deathStreamTicksRemaining: NATIVE_DEMON_SKULL_DEATH_STREAM_TICKS }
    emitEvent(work, tick, 'enemy-stream', actor.id, { stream: 'unholy-die' })
    emitEnemyActionSound(work, tick, actor, 'lightning-start', .5)
    emitEnemyActionSound(work, tick, actor, 'lightning-start', 1)
    emitEnemyActionSound(work, tick, actor, 'magic-shield-explode', 1)
    flash(work, actor, tick, 1, Math.fround(.05))
    for (const scaleMultiplier of [Math.fround(1.025), Math.fround(1.035)]) {
      spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, opacityTimer: 3, alphaLossPerTick: Math.fround(.005),
        atlas: 'DeadHawg', entry: 16, blendMode: 'add', kind: 'fade-scale-perspective', lifetimeTicks: 1000,
        presentationOwner: 'pre-world-queue', role: 'discorporeal-death-ring', scale: 2, scaleMultiplier, tint: UNHOLY_GREEN })
    }
  }
  const bodyPose = remaining <= 600 ? 2 : 1
  if (remaining === 600) flash(work, actor, tick, 1, Math.fround(.05))
  const strength = 10 * bodyPose ** 2 * (1 - Math.max(0, Math.min(1, (remaining - 500) / 800)))
  emitEvent(work, tick, 'enemy-camera-shake', actor.id, { sourcePosition: actor.position, cameraShake: {
    attenuation: 'fixed', displacement: randomEnemyOffset(work, strength) } })
  const bodyOffset = randomEnemyOffset(work, bodyPose * 3)
  let deathCountdown = remaining - 1
  const headingDeg = positiveModulo(Math.fround(actor.headingDeg + (1 - deathCountdown / 1000) * 10), 360)
  if (bodyPose === 2 || drawEnemyInteger(work, 4) === 1) {
    const angle = drawEnemyFloat(work, 360)
    const radius = Math.fround(50 + drawEnemyFloat(work, 50))
    const offset = radialVector(angle, radius)
    const rotationDeg = Math.fround(angle + drawEnemyFloat(work, 20, true))
    const scale = Math.fround(1 + drawEnemyFloat(work, 1))
    spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, alphaLossPerTick: Math.fround(.02), atlas: 'BadGuys',
      entry: 375 + drawEnemyInteger(work, 2), blendMode: 'add', kind: 'fade-additive', lifetimeTicks: 1000,
      position: { x: actor.position.x + offset.x, y: actor.position.y - 50 + offset.y },
      presentationOwner: 'pre-world-queue', role: 'discorporeal-death-branch', rotationDeg, scale, tint: UNHOLY_GREEN })
  }
  if (work.demonSkullEncounter.deathStreamTicksRemaining <= 0 && deathCountdown > 0) {
    deathCountdown = 0
    const megaDeath = (actor.brain.capabilities & 16) !== 0
    work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, tick, 0, 'ultra-banish'), position: actor.position,
      alpha: 1, flashAlpha: 1.5, lightRadius: 1, megaDeath, remainingTicks: megaDeath ? 2000 : 150 })
    emitEnemyActionSound(work, tick, actor, 'lightning-start', 1)
    emitEnemyActionSound(work, tick, actor, 'distort-reality', .5)
    emitEnemyActionSound(work, tick, actor, 'firey-death', .75)
    emitEnemyActionSound(work, tick, actor, 'firey-death', .5)
    emitEvent(work, tick, 'enemy-screen-flash', actor.id, { sourcePosition: actor.position, screenFlash: {
      red: .25, green: 1, blue: .25, alpha: 1, decayPerTick: Math.fround(.025), pointAttenuated: false } })
  }
  return { ...actor, bodyPose, deathTick: actor.deathTick + 1, headingDeg,
    brain: { ...actor.brain, bodyPose, bodyOffset, bodyHeadingDeg: headingDeg, deathCountdown } }
}

function flash(work: WorkingStep, actor: BoneyardDemonSkullActor, tick: number, alpha: number, decayPerTick: number): void {
  emitEvent(work, tick, 'enemy-screen-flash', actor.id, { sourcePosition: actor.position, screenFlash: {
    red: 140 / 255, green: 1, blue: 12 / 255, alpha, decayPerTick, pointAttenuated: false } })
}
