import { nativeMageBodyAttachment, nativeMageBodyPose } from '../../core-kernels/boneyard-mage-lightning.ts'
import { drawNativeFloat, drawNativeInteger } from '../../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder, type RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import { spawnSimpleDeathEffect } from './death-effects.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStore, WorkingStep } from './model.ts'
import { drawEnemyFloat, drawEnemyInteger } from './random.ts'
import { standaloneEnemyWorldManagerOrderState } from './registration.ts'

/** SkeletonMage 0x0048AE50 / DireFaculty 0x0048B5E0 disable casts, leaving walking active. */
export function dampenBoneyardCasters(source: BoneyardEnemyStore, targetIds: readonly number[],
  tick: number, register?: RegisterNativeWorldPainter): BoneyardEnemyStore {
  if (targetIds.length === 0) return source
  const targets = new Set(targetIds)
  const work = { deathEffects: [...source.deathEffects], nextDeathEffectId: source.nextDeathEffectId,
    registerWorldPainter: register ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register }
  let rng = source.steeringRngState
  const float = (maximum: number) => {
    const draw = drawNativeFloat(rng, maximum)
    rng = draw.state
    return draw.value
  }
  const integer = (maximum: number) => {
    const draw = drawNativeInteger(rng, maximum)
    rng = draw.state
    return draw.value
  }
  const actors = source.actors.map(actor => {
    if (!targets.has(actor.id) || actor.lifeState !== 'alive'
      || (actor.brain.family !== 'mage' && actor.brain.family !== 'faculty')) return actor
    spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, alphaLossPerTick: Math.fround(.02 * .25),
      atlas: 'BadGuys', blendMode: 'normal', entry: 15, kind: 'fade', lifetimeTicks: 201,
      presentationOwner: 'late-world-overlay', role: 'dampen-caster-flash', scale: 2 })
    for (let index = 0; index < 72; index += 1) {
      const entry = 10 + integer(2)
      const speed = float(3)
      const angle = float(360) * Math.PI / 180
      const velocityDamping = integer(6) === 3 ? Math.fround(.93) : Math.fround(.96)
      const rotationDeg = float(360)
      const scale = Math.fround(1.5 + float(.5))
      const alphaLossPerTick = Math.fround(Math.fround(.01) + float(Math.fround(.02)))
      const tint = Math.round(float(.25) * 255) * 0x010101
      const presentationOwner = integer(5) === 3 ? 'world-sorted' : 'pre-world-queue'
      spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, alphaLossPerTick, atlas: 'BadGuys',
        blendMode: 'normal', entry, kind: 'move-fade', lifetimeTicks: 101, presentationOwner,
        role: 'dampen-caster-smoke', rotationDeg, scale, tint,
        velocity: { x: Math.fround(Math.sin(angle) * speed), y: Math.fround(-Math.cos(angle) * speed) },
        velocityDamping })
    }
    return actor.brain.family === 'faculty'
      ? { ...actor, bodyPose: 0, brain: { ...actor.brain, action: null, bodyPose: 0,
          disabledPrimaryTicks: 500, handMask: 0, lightningActive: false, phase: 'range-control' as const } }
      : { ...actor, brain: { ...actor.brain, actionProgress: 0, disabledPrimaryTicks: 600,
          markerEmitted: false, phase: 'range-control' as const } }
  })
  return { ...source, actors, deathEffects: work.deathEffects, nextDeathEffectId: work.nextDeathEffectId,
    steeringRngState: rng }
}

export function spawnDampenedMageSmoke(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  if (actor.brain.family !== 'mage' || actor.brain.disabledPrimaryTicks === 0
    || actor.lifeState !== 'alive' || actor.config.scale === 0) return
  const pose = nativeMageBodyPose({ ...actor.brain, bodyPose: actor.bodyPose })
  for (const slot of [0, 1] as const) {
    if (drawEnemyInteger(work, 5) !== 1) continue
    const entry = drawEnemyInteger(work, 2) === 1 ? 10 : 11
    const scale = Math.fround(Math.fround(.45) + drawEnemyFloat(work,
      Math.fround(Math.fround(.65) - Math.fround(.45))))
    const tint = Math.round(drawEnemyFloat(work, Math.fround(.1)) * 255) * 0x010101
    const rotationDeg = drawEnemyFloat(work, 360)
    const attachment = nativeMageBodyAttachment(pose, actor.headingDeg, slot)
    const radius = drawEnemyFloat(work, 5)
    const angle = drawEnemyFloat(work, 360) * Math.PI / 180
    const alpha = Math.fround(.25 + drawEnemyFloat(work, .75))
    spawnSimpleDeathEffect(work, actor, tick, { alpha,
      alphaLossPerTick: Math.fround(Math.fround(.02) * Math.fround(.1)),
      atlas: 'BadGuys', blendMode: 'normal', entry, kind: 'fade', lifetimeTicks: 501,
      painterSortBias: 0,
      position: { x: Math.fround(Math.fround(actor.position.x + attachment.x) + Math.sin(angle) * radius),
        y: Math.fround(Math.fround(actor.position.y + attachment.y - 5) - Math.cos(angle) * radius) },
      role: `dampened-mage-hand-${slot}`, rotationDeg, scale, tint })
  }
}
