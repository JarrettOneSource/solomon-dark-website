import { randomBoneyardWaveInteger } from '../../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import {
  createNativeEnemyPathState,
  nativeEnemyTargetRefreshTicks,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import { emitEvent } from './events.ts'
import { nativeMaggotDeathOffsets } from './maggots.ts'
import type {
  BoneyardCoffinBrain,
  BoneyardEnemyActor,
  BoneyardEnemyStoreStepContext,
  BoneyardMaggotActor,
  WorkingStep,
} from './model.ts'
import { positiveModulo } from './movement.ts'
import {
  NATIVE_COFFIN_HOLD_MINIMUM_TICKS,
  NATIVE_COFFIN_HOLD_RANDOM_COUNT,
  NATIVE_COFFIN_MAGGOT_CHARGE_MAXIMUM,
  NATIVE_COFFIN_MAGGOT_CHARGE_PER_TICK,
  NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
  NATIVE_COFFIN_OPEN_TICKS,
  NATIVE_COFFIN_RISE_TICKS,
  NATIVE_MAGGOT_PROGRAM,
} from './programs.ts'
import { drawInteger, drawUnit, radialVector } from './random.ts'

export function stepCoffin(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardCoffinBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const tick = context.tick
  if (brain.phase === 'open') {
    const speed = Math.fround(actor.config.baseSpeed * actor.staffMovementFactor)
    if (!(speed > 0)) return actor
    const ratio = Math.fround(brain.maggotCharge / speed)
    const count = ratio < 1
      ? 3
      : drawUnit(work) * ratio < 1 ? 1 : 0
    spawnCoffinMaggots(work, actor, context, count)
    if (count > 0) {
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, { count })
    }
    return {
      ...actor,
      brain: {
        ...brain,
        maggotCharge: Math.min(
          NATIVE_COFFIN_MAGGOT_CHARGE_MAXIMUM,
          Math.fround(brain.maggotCharge + NATIVE_COFFIN_MAGGOT_CHARGE_PER_TICK),
        ),
      },
    }
  }
  const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
  if (remaining > 0) {
    return {
      ...actor,
      brain: { ...brain, phaseTick: brain.phaseTick + 1, phaseTicksRemaining: remaining },
    }
  }
  switch (brain.phase) {
    case 'hidden': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'rising',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_RISE_TICKS,
      },
    }
    case 'rising': {
      const hold = randomBoneyardWaveInteger(work.rngState, NATIVE_COFFIN_HOLD_RANDOM_COUNT)
      work.rngState = hold.state
      return {
        ...actor,
        brain: {
          ...brain,
          phase: 'holding',
          phaseTick: 0,
          phaseTicksRemaining: NATIVE_COFFIN_HOLD_MINIMUM_TICKS + hold.value,
        },
      }
    }
    case 'holding': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'opening',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_OPEN_TICKS,
      },
    }
    case 'opening': {
      const count = spawnCoffinMaggots(
        work,
        actor,
        context,
        NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
      )
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, {
        count,
      })
      return {
        ...actor,
        brain: {
          ...brain,
          maggotCharge: 0,
          phase: 'open',
          phaseTick: NATIVE_COFFIN_OPEN_TICKS,
          phaseTicksRemaining: 0,
        },
      }
    }
    case 'death': return actor
  }
}

function spawnCoffinMaggots(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
  requestedCount: number,
): number {
  if (actor.config.enemyToken !== 'COFFIN' || actor.brain.family !== 'coffin') return 0
  const family = actor.config.family
  const brain = actor.brain
  const count = requestedCount
  for (let index = 0; index < count; index += 1) {
    const launchTrajectory: BoneyardMaggotActor['launchTrajectory'] = drawInteger(work, 2) === 0
      ? 'edge'
      : 'lid'
    const segment = NATIVE_MAGGOT_PROGRAM.launchSegments[launchTrajectory]
    const segmentStart = transformCoffinLaunchPoint(segment.start, brain)
    const segmentEnd = transformCoffinLaunchPoint(segment.end, brain)
    const interpolation = drawUnit(work)
    const localX = segmentStart.x + (segmentEnd.x - segmentStart.x) * interpolation
    const localY = segmentStart.y + (segmentEnd.y - segmentStart.y) * interpolation
    const sourceHeadingDeg = segment.headingMinimumDeg
      + drawUnit(work) * (segment.headingMaximumDeg - segment.headingMinimumDeg)
    const headingDeg = positiveModulo(
      brain.launchScale < 0 ? 360 - sourceHeadingDeg : sourceHeadingDeg,
      360,
    )
    const visualScale = 1 + drawUnit(work) * 0.25
    const launchVelocity = radialVector(headingDeg, 1)
    const emergencePhase = drawUnit(work) * 5
    const landingBounceVelocity = Math.fround(-drawUnit(work) * 0.5)
    const verticalOffset = Math.fround(localY - segmentStart.y - drawUnit(work) * 8)
    const position = Object.freeze({
      x: actor.position.x + localX,
      y: actor.position.y + segmentStart.y - drawUnit(work) * 8,
    })
    const hurricaneContactCooldown = drawInteger(work, 100)
    const path = createNativeEnemyPathState(work.steeringRngState)
    work.steeringRngState = path.rngState
    work.maggots.push(Object.freeze({
      blizzardPushAccumulator: 0,
      blizzardPushLastTick: null,
      collisionRadius: NATIVE_MAGGOT_PROGRAM.collisionRadius,
      combatActive: false,
      currentHealth: family.maggotHealth,
      deathOffsets: nativeMaggotDeathOffsets(work),
      damage: family.maggotDamage,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      emergencePhase,
      emergenceTick: 0,
      gaitPose: 0,
      headingDeg,
      hurricaneContactCooldown,
      id: work.nextActorId,
      launchTrajectory,
      launchVelocity: Object.freeze(launchVelocity),
      landingBounceVelocity,
      lastAttackTick: null,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightRegistration: work.registerWorldPainter('actor'),
      maximumHealth: family.maggotHealth,
      movementPhase: 'emerging',
      nextAttackTick: context.tick + NATIVE_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      nextMovementTick: context.tick + 1,
      nextTargetRefreshTick: context.tick + nativeEnemyTargetRefreshTicks(1),
      nativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nativeRegistrationOrder: work.nextNativeRegistrationOrder,
      ownerCoffinActorId: actor.id,
      path: path.state,
      poisonDamage: family.maggotPoisonDamage,
      poisonDuration: family.maggotPoisonDamage > 0
        ? NATIVE_MAGGOT_PROGRAM.poisonDurationTicks
        : 0,
      position,
      spawnTick: context.tick,
      staffActionFactor: 1,
      staffMovementFactor: 1,
      targetPlayerId: null,
      terminalEmitted: false,
      verticalOffset,
      verticalVelocity: 0,
      visualScale,
    }))
    work.nextNativeCellBindingOrder += 1
    work.nextNativeRegistrationOrder += 1
    work.spawnedActorIds.push(work.nextActorId)
    emitEvent(work, context.tick, 'enemy-spawned', work.nextActorId, {
      targetPlayerId: null,
    })
    work.nextActorId += 1
  }
  return count
}

function transformCoffinLaunchPoint(
  point: Readonly<BoneyardPoint>,
  brain: BoneyardCoffinBrain,
): Readonly<BoneyardPoint> {
  const radians = brain.launchRotationDeg * Math.PI / 180
  const x = point.x * brain.launchScale
  return {
    x: x * Math.cos(radians) - point.y * Math.sin(radians),
    y: x * Math.sin(radians) + point.y * Math.cos(radians),
  }
}
