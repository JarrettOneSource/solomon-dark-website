import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import {
  createNativeDemonSkullAction,NATIVE_DEMON_SKULL_SCREAM_TICKS,
  type NativeDemonSkullAction,type NativeDemonSkullActionKind
} from '../../core-kernels/native-demon-skull.ts'
import { nativeHeadingTurnDirection } from '../../core-kernels/primary-spell-targeting.ts'
import { spawnDemonSkullWarmup } from './demon-skull-effects.ts'
import { biteDemonSkull, fireDemonSkullEyes, spitDemonSkullFire, stepDemonSkullMouthBeam } from './demon-skull-spells.ts'
import { emitEnemyActionSound, emitEvent } from './events.ts'
import type { BoneyardDemonSkullActor, BoneyardEnemyStoreStepContext, WorkingStep } from './model.ts'
import { positiveModulo } from './movement.ts'
import { drawEnemyFloat, randomEnemyOffset as randomOffset } from './random.ts'
import { targetEligible } from './targeting.ts'

export function beginDemonSkullAction(work: WorkingStep, source: BoneyardDemonSkullActor,
  kind: NativeDemonSkullActionKind, context: BoneyardEnemyStoreStepContext, authoredAttackSpeed: number): BoneyardDemonSkullActor {
  const target = source.targetPlayerId === null ? null : context.players[source.targetPlayerId]
  const targetHeading = target && targetEligible(target) ? actorHeadingFromVector(
    target.position.x - source.position.x, target.position.y - source.position.y) : null
  const action = createNativeDemonSkullAction(kind, source.headingDeg, targetHeading,
    authoredAttackSpeed, source.lootSeed)
  let brain = { ...source.brain, actions: [...source.brain.actions, action] }
  if (kind === 'scream' || kind === 'flair') {
    work.demonSkullEncounter = { ...work.demonSkullEncounter, screamStreamTicksRemaining: NATIVE_DEMON_SKULL_SCREAM_TICKS }
    emitEvent(work, context.tick, 'enemy-stream', source.id, { stream: 'unholy-scream' })
    brain = { ...brain, bodyPose: 1, screamActive: kind === 'scream' || brain.screamActive }
  }
  if (kind === 'eyes' || kind === 'mouth') {
    brain = { ...brain, chargeGlow: 0 }
    emitEnemyActionSound(work, context.tick, source, 'eye-laser-charge', authoredAttackSpeed * (kind === 'eyes' ? 2 : .5))
  }
  return { ...source, bodyPose: brain.bodyPose, brain }
}

/** ActionManager 0x00483000 removes previously retired entries before visiting the live list. */
export function stepDemonSkullActions(work: WorkingStep, source: BoneyardDemonSkullActor,
  context: BoneyardEnemyStoreStepContext): BoneyardDemonSkullActor {
  let actor = source
  const actions: NativeDemonSkullAction[] = []
  for (const action of source.brain.actions) {
    if (action.retired) continue
    const stepped = stepAction(work, actor, action, context)
    actor = stepped.actor
    actions.push(stepped.action)
  }
  return { ...actor, bodyPose: actor.brain.bodyPose, brain: { ...actor.brain, actions } }
}

function stepAction(work: WorkingStep, source: BoneyardDemonSkullActor,
  action: NativeDemonSkullAction, context: BoneyardEnemyStoreStepContext): {
    actor: BoneyardDemonSkullActor; action: NativeDemonSkullAction
  } {
  let actor = source
  let brain = source.brain
  let headingDeg = actor.headingDeg
  const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
  const liveTarget = target && targetEligible(target) ? target : null
  const aim = liveTarget === null ? null : actorHeadingFromVector(
    liveTarget.position.x - actor.position.x, liveTarget.position.y - actor.position.y)
  const finish = (next: NativeDemonSkullAction) => ({ actor: { ...actor, headingDeg,
    bodyPose: brain.bodyPose, brain }, action: next })
  const turn = (targetHeading: number, speed: number) => {
    headingDeg = positiveModulo(Math.fround(headingDeg + nativeHeadingTurnDirection(headingDeg, targetHeading) * speed), 360)
    brain = { ...brain, headingDelayTicks: 11 }
  }
  const recover = () => { brain = { ...brain, targetSpeed: Math.fround(actor.config.scale * 4), spin: 0, chargeGlow: 0 } }
  switch (action.kind) {
    case 'scream': return finish(action)
    case 'bite': {
      if (action.progress === 0) emitEnemyActionSound(work, context.tick, actor, 'skull-bite', 1)
      const time = (context.abilityEffects?.[actor.id]?.timeScale ?? 1) * actor.staffActionFactor
      const progress = Math.fround(action.progress + Math.fround(action.rate * time))
      brain = { ...brain, bodyPose: Math.trunc(progress) < 4 ? 1 : 0 }
      // The native interval includes both endpoints, including an exact marker on consecutive ticks.
      const marker = progress > action.progress && action.progress <= 4 && progress >= 4
      if (marker) {
        actor = biteDemonSkull(work, { ...actor, brain }, context)
        headingDeg = actor.headingDeg
        brain = actor.brain
      }
      return finish({ ...action, progress, markerEmitted: action.markerEmitted || marker, retired: progress > 13 })
    }
    case 'eyes': {
      brain = { ...brain, chargeGlow: Math.min(1, Math.fround(brain.chargeGlow + Math.fround(.025))) }
      if (action.warmupTicks > 0) {
        brain = { ...brain, jitter: randomOffset(work, 3) }
        spawnDemonSkullWarmup(work, actor, context.tick, 'eyes')
        turn(aim ?? headingDeg, 1)
        return finish({ ...action, warmupTicks: action.warmupTicks - 1 })
      }
      if (action.shotsRemaining <= 0) {
        brain = { ...brain, chargeGlow: Math.max(0, Math.fround(brain.chargeGlow - Math.fround(.05))) }
        const recoveryTicks = action.recoveryTicks - 1
        if (recoveryTicks <= 0) recover()
        return finish({ ...action, recoveryTicks, retired: recoveryTicks <= 0 })
      }
      if (action.shotsRemaining >= 3) brain = { ...brain, jitter: randomOffset(work, 3) }
      const time = (context.abilityEffects?.[actor.id]?.timeScale ?? 1) * actor.staffActionFactor
      const eyeCharge = Math.min(1, Math.fround(brain.eyeCharge + action.attackSpeed * Math.fround(.025) * time))
      headingDeg = aim ?? headingDeg
      brain = { ...brain, eyeCharge, headingDelayTicks: 11 }
      if (eyeCharge < 1) return finish(action)
      brain = { ...brain, jitter: { x: 0, y: 0 }, eyeCharge: 0 }
      actor = fireDemonSkullEyes(work, { ...actor, headingDeg, brain }, context)
      brain = { ...actor.brain, spin: drawEnemyFloat(work, 15, true), chargeGlow: 0 }
      return finish({ ...action, shotsRemaining: action.shotsRemaining - 1 })
    }
    case 'mouth': {
      brain = { ...brain, chargeGlow: Math.min(1, Math.fround(brain.chargeGlow + Math.fround(.025))) }
      if (action.warmupTicks > 0) {
        brain = { ...brain, jitter: randomOffset(work, action.warmupJitter) }
        spawnDemonSkullWarmup(work, actor, context.tick, 'mouth')
        let warmupTurnSpeed = action.warmupTurnSpeed
        if (aim !== null && warmupTurnSpeed > 0) {
          turn(aim, warmupTurnSpeed)
          warmupTurnSpeed = Math.fround(warmupTurnSpeed - Math.fround(.004))
        }
        const warmupTicks = action.warmupTicks - 1
        if (warmupTicks === 0) {
          emitEvent(work, context.tick, 'enemy-screen-flash', actor.id, { sourcePosition: actor.position,
            screenFlash: { red: Math.fround(.55), green: 1, blue: Math.fround(.05), alpha: 1,
              decayPerTick: Math.fround(.05), pointAttenuated: true } })
          emitEnemyActionSound(work, context.tick, actor, 'lightning-start', 1)
        }
        return finish({ ...action, warmupTicks, warmupTurnSpeed,
          warmupJitter: Math.fround(action.warmupJitter + Math.fround(.05)) })
      }
      if (action.beamPower <= 0) {
        const recoveryTicks = action.recoveryTicks - 1
        if (recoveryTicks < 0) {
          recover()
          brain = { ...brain, bodyOffset: { x: 0, y: 0 } }
        }
        return finish({ ...action, recoveryTicks, retired: recoveryTicks < 0 })
      }
      brain = { ...brain, bodyPose: 1, chargeGlow: 0, bodyPhaseDeg: 0, bodyOffset: randomOffset(work, 3) }
      const trackingDelayTicks = action.trackingDelayTicks - 1
      let trackingRamp = action.trackingRamp
      if (trackingDelayTicks <= 0 && aim !== null) {
        turn(aim, Math.fround(.5 * trackingRamp))
        trackingRamp = Math.min(1, Math.fround(trackingRamp + Math.fround(.01)))
      }
      emitEvent(work, context.tick, 'enemy-camera-shake', actor.id, { sourcePosition: actor.position,
        cameraShake: { attenuation: 'point', displacement: randomOffset(work, 10) } })
      stepDemonSkullMouthBeam(work, { ...actor, headingDeg, brain }, context, action.beamPower)
      const beamPower = Math.fround(action.beamPower - Math.fround(.015))
      if (beamPower <= 0) {
        brain = { ...brain, bodyPose: 0, bodyOffset: { x: 0, y: 0 } }
        emitEnemyActionSound(work, context.tick, actor, 'jaw', 1)
      }
      return finish({ ...action, beamPower, trackingDelayTicks, trackingRamp })
    }
    case 'spit': {
      if (action.mouthTicks > 0) {
        const mouthTicks = action.mouthTicks - 1
        if (mouthTicks === 0) brain = { ...brain, bodyPose: 0 }
        return finish({ ...action, mouthTicks })
      }
      turn(action.targetHeadingDeg, 1)
      const targetHeadingDeg = liveTarget === null ? headingDeg : liveTarget.summoned
        ? aim! : actorHeadingFromVector(liveTarget.position.x + liveTarget.velocityPerTick.x * 260 - actor.position.x,
          liveTarget.position.y + liveTarget.velocityPerTick.y * 260 - actor.position.y)
      const cooldownTicks = action.cooldownTicks - 1
      if (cooldownTicks > 0 || Math.abs(headingDeg - targetHeadingDeg) >= 3) return finish({ ...action, cooldownTicks, targetHeadingDeg })
      brain = { ...brain, bodyPose: 1 }
      actor = spitDemonSkullFire(work, { ...actor, headingDeg, brain }, context)
      headingDeg = actor.headingDeg
      brain = actor.brain
      const shotsRemaining = action.shotsRemaining - 1
      if (shotsRemaining <= 0) {
        recover()
        brain = { ...brain, bodyPose: 0 }
      }
      return finish({ ...action, cooldownTicks: 75, mouthTicks: 35, targetHeadingDeg, shotsRemaining, retired: shotsRemaining <= 0 })
    }
    case 'flair': {
      brain = { ...brain, bodyPose: 1 }
      if (action.settlingTicks > 0) {
        headingDeg = action.originalHeadingDeg
        const settlingTicks = action.settlingTicks + 1
        if (settlingTicks >= 50) {
          brain = { ...brain, bodyPose: 0 }
          emitEnemyActionSound(work, context.tick, actor, 'jaw', 1)
        }
        return finish({ ...action, settlingTicks, retired: settlingTicks >= 50 })
      }
      const remainingTicks = action.remainingTicks - 1
      headingDeg = Math.fround(Math.sin(remainingTicks / 200 * 630 * Math.PI / 180) * 40 + action.originalHeadingDeg)
      brain = { ...brain, bodyHeadingDeg: headingDeg, flairGlow: action.glow }
      emitEvent(work, context.tick, 'enemy-camera-shake', actor.id, { sourcePosition: actor.position,
        cameraShake: { attenuation: 'fixed', displacement: randomOffset(work, 3) } })
      return finish({ ...action, remainingTicks, settlingTicks: remainingTicks <= 0 ? 1 : 0,
        glow: Math.min(1, Math.fround(action.glow + Math.fround(.05))) })
    }
  }
}
