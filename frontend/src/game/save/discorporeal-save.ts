import type { NativeDemonSkullAction } from '../core-kernels/native-demon-skull.ts'
import type { BoneyardDemonSkullBrain } from '../core-server/enemies/model.ts'
import { nativeDemonSkullVisual } from '../protocol/codecs/demon-skull.ts'
import { boneyardPoint } from '../protocol/codecs/native-state.ts'
import { array, boolean, boundedInteger, finite, onlyKeys, record } from '../protocol/codecs/values.ts'

export function normalizeSavedDiscorporeal(value: unknown): BoneyardDemonSkullBrain {
  const field = 'saved Discorporeal'
  const source = record(value, field)
  const { actions, attackTicksRemaining, capabilities, deathCountdown, family, headingDelayTicks,
    pendingAttack, phase, recoil, screamActive, seen, speed, targetSpeed, ...visual } = source
  if (family !== 'demon-skull') throw new Error(`${field} family is invalid`)
  if (phase !== 'range-control' && phase !== 'cast' && phase !== 'death') throw new Error(`${field} phase is invalid`)
  if (pendingAttack !== null && pendingAttack !== 'eyes' && pendingAttack !== 'mouth' && pendingAttack !== 'spit') {
    throw new Error(`${field} pending attack is invalid`)
  }
  return {
    ...nativeDemonSkullVisual(visual, field),
    actions: array(actions, `${field} actions`).map((action, index) => savedAction(action, `${field} action ${index}`)),
    attackTicksRemaining: signedCounter(attackTicksRemaining, `${field} attack timer`),
    capabilities: boundedInteger(capabilities, `${field} capabilities`, 0, 63),
    deathCountdown: signedCounter(deathCountdown, `${field} death countdown`),
    family,
    headingDelayTicks: signedCounter(headingDelayTicks, `${field} heading delay`),
    pendingAttack, phase,
    recoil: boneyardPoint(recoil, `${field} recoil`),
    screamActive: boolean(screamActive, `${field} scream active`),
    seen: boolean(seen, `${field} seen`),
    speed: finite(speed, `${field} speed`),
    targetSpeed: finite(targetSpeed, `${field} target speed`),
  }
}

function signedCounter(value: unknown, field: string): number {
  return boundedInteger(value, field, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
}

function savedAction(value: unknown, field: string): NativeDemonSkullAction {
  const source = record(value, field)
  const retired = boolean(source.retired, `${field} retired`)
  const { kind } = source
  switch (kind) {
    case 'scream':
      onlyKeys(source, field, ['kind', 'retired'])
      return { kind, retired }
    case 'bite':
      onlyKeys(source, field, ['kind', 'retired', 'progress', 'rate', 'markerEmitted'])
      return { kind, retired, progress: finite(source.progress, `${field} progress`),
        rate: finite(source.rate, `${field} rate`), markerEmitted: boolean(source.markerEmitted, `${field} marker`) }
    case 'eyes':
      onlyKeys(source, field, ['kind', 'retired', 'warmupTicks', 'shotsRemaining', 'recoveryTicks', 'attackSpeed'])
      return { kind, retired, warmupTicks: signedCounter(source.warmupTicks, `${field} warmup`),
        shotsRemaining: signedCounter(source.shotsRemaining, `${field} shots`),
        recoveryTicks: signedCounter(source.recoveryTicks, `${field} recovery`),
        attackSpeed: finite(source.attackSpeed, `${field} attack speed`) }
    case 'mouth':
      onlyKeys(source, field, ['kind', 'retired', 'warmupTicks', 'warmupJitter', 'warmupTurnSpeed',
        'beamPower', 'trackingDelayTicks', 'trackingRamp', 'recoveryTicks'])
      return { kind, retired, warmupTicks: signedCounter(source.warmupTicks, `${field} warmup`),
        warmupJitter: finite(source.warmupJitter, `${field} warmup jitter`),
        warmupTurnSpeed: finite(source.warmupTurnSpeed, `${field} turn speed`),
        beamPower: finite(source.beamPower, `${field} beam power`),
        trackingDelayTicks: signedCounter(source.trackingDelayTicks, `${field} tracking delay`),
        trackingRamp: finite(source.trackingRamp, `${field} tracking ramp`),
        recoveryTicks: signedCounter(source.recoveryTicks, `${field} recovery`) }
    case 'spit':
      onlyKeys(source, field, ['kind', 'retired', 'shotsRemaining', 'cooldownTicks', 'mouthTicks', 'targetHeadingDeg'])
      return { kind, retired, shotsRemaining: signedCounter(source.shotsRemaining, `${field} shots`),
        cooldownTicks: signedCounter(source.cooldownTicks, `${field} cooldown`),
        mouthTicks: signedCounter(source.mouthTicks, `${field} mouth timer`),
        targetHeadingDeg: finite(source.targetHeadingDeg, `${field} target heading`) }
    case 'flair':
      onlyKeys(source, field, ['kind', 'retired', 'remainingTicks', 'settlingTicks', 'glow', 'originalHeadingDeg'])
      return { kind, retired, remainingTicks: signedCounter(source.remainingTicks, `${field} remaining ticks`),
        settlingTicks: signedCounter(source.settlingTicks, `${field} settling ticks`),
        glow: finite(source.glow, `${field} glow`), originalHeadingDeg: finite(source.originalHeadingDeg, `${field} original heading`) }
    default: throw new Error(`${field} kind is invalid`)
  }
}
