import { createNativePuppetHit } from '../../core-kernels/native-puppet-hit.ts'
import { createNativeDemonArticulationState } from '../../core-kernels/boneyard-demon-articulation.ts'
import type { EvaluatedBoneyardEnemyConfig } from '../../core-kernels/boneyard-enemy-config-model.ts'
import { evaluateBoneyardEnemyConfig } from '../../core-kernels/boneyard-enemy-config.ts'
import { boundedMageShieldIntervalTicks } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import { createNativeImpFlightState } from '../../core-kernels/boneyard-imp-flight.ts'
import type { BoneyardEnemySpawnIntent } from '../../core-kernels/boneyard-wave-director.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../../core-kernels/boneyard-wave-director.ts'
import { nextBoneyardWaveRandom, randomBoneyardWaveInteger } from '../../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { createNativeDemonSkull } from '../../core-kernels/native-demon-skull.ts'
import { createNativeEnemyPathState, nativeEnemyTargetRefreshTicks } from '../../core-kernels/native-enemy-pathfinding.ts'
import { constructNativeRangedAttackRange } from '../../core-kernels/native-enemy-targeting.ts'
import { createNativeFacultyVoiceController } from '../../core-kernels/native-faculty-voices.ts'
import { createNativeFaculty, registerNativeFaculty } from '../../core-kernels/native-faculty.ts'
import { createNativeHeartmonger } from '../../core-kernels/native-heartmonger.ts'
import { drawNativeFloat, drawNativeSign } from '../../core-kernels/native-rng.ts'
import { createNativeSpiderState } from '../../core-kernels/native-spider.ts'
import { NATIVE_PORTAL_ACTOR_PROGRAM, createNativePortalState, nativePortalChildPosition } from '../../core-kernels/native-survival-portal.ts'
import type { RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import { NATIVE_WRAITH_FLYBY_TICKS, createNativeWraithFlightState } from '../../core-kernels/native-wraith-flight.ts'
import { nextEnemyLootSeed } from '../boneyard-enemy-loot-seed.ts'
import { NATIVE_BADGUY_NAVIGATION_CLEARANCE, NATIVE_DEMON_NAVIGATION_CLEARANCE } from '../boneyard-enemy-navigation.ts'
import { emitEvent } from './events.ts'
import type { BoneyardEnemyActor, BoneyardEnemyBrain, BoneyardEnemySemanticEvent, BoneyardEnemyStore, BoneyardEnemyStoreStepContext, BoneyardEnemyTargets, BoneyardImpBrain, WorkingStep } from './model.ts'
import { validatePoint } from './model.ts'
import { NATIVE_COFFIN_HIDDEN_LONG_TICKS, NATIVE_COFFIN_HIDDEN_SHORT_TICKS, NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS, NATIVE_IMP_CONSTRUCTION_MAXIMUM, NATIVE_IMP_SPLIT_HEADING_OFFSETS, NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM } from './programs.ts'
import { drawInteger, drawLocomotionInteger, drawLocomotionPhase, drawLocomotionStridePhase, drawUnit, signedUnit } from './random.ts'
import { skeletonAction } from './skeleton-family.ts'
import { nearestEligibleTarget, targetHeading } from './targeting.ts'
import { createEnemyWork, finishEnemyStore } from './work.ts'
export function materializeSpawnIntents(
  work: WorkingStep,
  context: ConstructionContext,
  spawnIntents: readonly BoneyardEnemySpawnIntent[],
  impSplitDepthOverride: number | null = null,
): BoneyardEnemyActor[] {
  const actors: BoneyardEnemyActor[] = []
  const placementGroups = new Map<number, Readonly<BoneyardPoint>>()
  for (const intent of spawnIntents) {
    const baseSpeed = nextBoneyardWaveRandom(work.rngState)
    const radius = nextBoneyardWaveRandom(baseSpeed.state)
    const armor = nextBoneyardWaveRandom(radius.state)
    const split = nextBoneyardWaveRandom(armor.state)
    const splitMany = intent.flags.includes('FLAG_SPLITMANY')
      ? nextBoneyardWaveRandom(split.state)
      : null
    work.rngState = splitMany?.state ?? split.state
    const evaluatedConfig = evaluateBoneyardEnemyConfig(intent.enemyToken, {
      arenaScalars: context.arenaScalars,
      authoredRecipe: intent.authoredRecipe,
      flags: intent.flags,
      flanking: intent.flanking,
      mageCloak: intent.mageCloak,
      pathfindingMode: intent.pathfindingMode,
      random: {
        baseSpeedUnit: baseSpeed.value,
        collisionRadiusUnit: radius.value,
        randomArmor: armor.value >= 0.5,
        splitManyGateUnit: split.value,
        splitManyUnit: splitMany?.value ?? 0,
        splitUnit: split.value >= 0.5 ? 1 : 0,
      },
      waveOrdinal: intent.waveOrdinal,
      zombieBodyType: intent.zombieBodyType,
    })
    const inheritedConfig = impSplitDepthOverride === null
      ? evaluatedConfig
      : withImpSplitDepth(evaluatedConfig, impSplitDepthOverride)
    let config = intent.portalEjection === undefined
      ? inheritedConfig
      : withPortalEjectionDamage(inheritedConfig, intent.portalEjection)
    if (intent.greenImpSpitDamage !== undefined) {
      if (config.enemyToken !== 'IMP' || intent.nativeTypeId !== 2044
        || !Number.isFinite(intent.greenImpSpitDamage) || intent.greenImpSpitDamage < 0) {
        throw new Error('GreenImp requires its native Imp payload')
      }
      config = { ...config, maximumHealth: 1, nativeTypeId: 2044,
        primaryDamage: intent.greenImpSpitDamage / 20, experience: intent.greenImpSpitDamage / 20 }
    }
    if (
      config.enemyToken === 'IMP'
      && intent.portalEjection === undefined
      && work.impActorCount >= NATIVE_IMP_CONSTRUCTION_MAXIMUM
    ) continue
    const rawPosition = intent.portalEjection === undefined
      ? intent.position
      : nativePortalChildPosition(
          intent.portalEjection.parentPosition,
          intent.portalEjection.parentHeadingDeg,
          intent.portalEjection.childHeadingDeg,
          config.collisionRadius,
        )
    const placementGroupId = intent.placementGroupId
    if (
      placementGroupId !== undefined
      && (!Number.isSafeInteger(placementGroupId) || placementGroupId < 1)
    ) throw new RangeError('enemy placement group id must be a positive safe integer')
    const cachedPosition = placementGroupId === undefined
      ? undefined
      : placementGroups.get(placementGroupId)
    let position: Readonly<BoneyardPoint>
    if (cachedPosition) {
      position = cachedPosition
    } else {
      const placement = context.resolveSpawnPlacement?.({
        actorId: work.nextActorId,
        navigationClearance: intent.navigationClearance ?? (
          config.enemyToken === 'DEMON'
            ? NATIVE_DEMON_NAVIGATION_CLEARANCE
            : NATIVE_BADGUY_NAVIGATION_CLEARANCE
        ),
        position: rawPosition,
        positionPolicy: intent.positionPolicy ?? 'direct',
        radius: intent.placementRadius ?? config.collisionRadius,
        reachabilityRadius: intent.reachabilityRadius ?? config.collisionRadius,
        rngState: work.steeringRngState,
      })
      if (placement) work.steeringRngState = placement.rngState
      position = placement?.position ?? context.resolveMovement({
        actorId: work.nextActorId,
        delta: { x: 0, y: 0 },
        position: rawPosition,
        purpose: 'spawn-placement',
        radius: intent.placementRadius ?? config.collisionRadius,
        requestedPosition: rawPosition,
      })
      if (placementGroupId !== undefined) {
        placementGroups.set(placementGroupId, Object.freeze({ ...position }))
      }
    }
    validatePoint(position, 'resolved enemy spawn position')
    const targetPlayerId = nearestEligibleTarget(position, context.players)
    const stridePhaseDeg = config.enemyToken === 'ZOMBIE'
      ? drawLocomotionStridePhase(work)
      : 0
    const gaitPose = drawLocomotionPhase(work)
    const bodyGaitPhase = drawLocomotionPhase(work)
    const path = createNativeEnemyPathState(work.steeringRngState)
    work.steeringRngState = path.rngState
    const headingDeg = intent.portalEjection?.childHeadingDeg
      ?? targetHeading(position, targetPlayerId, context.players)
    if (intent.enableDiscorporealHealthGates) {
      work.demonSkullEncounter = { ...work.demonSkullEncounter, healthTriggersEnabled: true }
    }
    const createdBrain = createBrain(work, config, {
      cocoonTargetPlayerId: intent.cocoonTargetPlayerId,
      actorId: work.nextActorId,
      facultyMemberCount: work.actors.filter(actor => actor.brain.family === 'faculty' && actor.lifeState === 'alive').length
        + actors.filter(actor => actor.brain.family === 'faculty').length + 1,
      headingDeg,
      position,
      spawnTick: intent.spawnTick,
    })
    const brain = intent.portalEjection === undefined
      ? createdBrain
      : withPortalEjectionFlight(createdBrain, intent.portalEjection)
    const restBodyPose = config.enemyToken === 'SKELETONMAGE'
      ? drawLocomotionInteger(work, 2)
      : 0
    const hurricaneContactCooldown = drawInteger(work, 100)
    const actor: BoneyardEnemyActor = {
      blizzardPushAccumulator: 0,
      blizzardPushLastTick: null,
      bodyGaitPhase,
      bodyPose: restBodyPose,
      brain,
      config,
      currentHealth: config.maximumHealth,
      deathEpoch: null,
      deathPresentationStarted: false,
      deathStartedTick: null,
      deathTick: 0,
      gaitPose,
      headFacingOffset: 0,
      headingDeg,
      hurricaneContactCooldown,
      id: work.nextActorId,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      hitFeedback: createNativePuppetHit(context.tick),
      lastMovementTick: null,
      lethalMagicDamage: false,
      shadowLateralOffset: 0,
      lifeState: 'alive',
      lightRegistration: work.registerWorldPainter('actor'),
      lighting: Object.freeze({ charge: 0, glow: 0, providerCopies: 0 }),
      lootSeed: nextEnemyLootSeed(work, context.rollLootSeed),
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: context.tick
        + nativeEnemyTargetRefreshTicks(config.pathfindingMode),
      nativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nativeRegistrationOrder: work.nextNativeRegistrationOrder,
      path: config.enemyToken === 'DIREFACULTY' ? { ...path.state, flankRadius: 300 } : path.state,
      position: Object.freeze({ ...position }),
      rewardGranted: false,
      restBodyPose,
      shieldHealth: 0,
      shieldMaximumHealth: 0,
      shieldPulse: 0,
      shieldSoundCooldownTicks: 0,
      sourceSpawnIntentId: intent.id,
      spawnTick: intent.spawnTick,
      staffActionFactor: 1,
      staffMovementFactor: 1,
      stridePhaseDeg,
      targetPlayerId,
      terminalEmitted: false,
      waveOrdinal: intent.waveOrdinal,
    }
    work.nextNativeCellBindingOrder += 1
    work.nextNativeRegistrationOrder += 1
    if (work.featuredBossId === null
      && (config.classification === 'boss' || config.classification === 'multiple-boss')) {
      work.featuredBossId = actor.id
    }
    work.nextActorId += 1
    if (config.enemyToken === 'IMP') work.impActorCount += 1
    work.spawnedActorIds.push(actor.id)
    emitEvent(work, context.tick, 'enemy-spawned', actor.id, {
      targetPlayerId,
    })
    actors.push(actor)
  }
  return actors
}

function withImpSplitDepth(
  config: EvaluatedBoneyardEnemyConfig,
  splitDepth: number,
): EvaluatedBoneyardEnemyConfig {
  if (config.enemyToken !== 'IMP') {
    throw new Error('only child Imps can inherit reduced split state')
  }
  if (!Number.isSafeInteger(splitDepth) || splitDepth < 0) {
    throw new RangeError('inherited Imp split depth must be a non-negative safe integer')
  }
  return Object.freeze({
    ...config,
    family: Object.freeze({ ...config.family, splitDepth }),
  })
}

function withPortalEjectionDamage(
  config: EvaluatedBoneyardEnemyConfig,
  ejection: NonNullable<BoneyardEnemySpawnIntent['portalEjection']>,
): EvaluatedBoneyardEnemyConfig {
  if (config.enemyToken !== 'IMP') {
    throw new Error('only an Imp can consume a Portal ejection payload')
  }
  validatePortalEjection(ejection)
  return Object.freeze({
    ...config,
    primaryDamage: ejection.inheritedPrimaryDamage,
  })
}

function withPortalEjectionFlight(
  brain: BoneyardEnemyBrain,
  ejection: NonNullable<BoneyardEnemySpawnIntent['portalEjection']>,
): BoneyardImpBrain {
  if (brain.family !== 'imp') {
    throw new Error('only an Imp brain can consume a Portal ejection payload')
  }
  return {
    ...brain,
    baseHorizontalSpeed: NATIVE_PORTAL_ACTOR_PROGRAM.childBaseHorizontalSpeed,
    horizontalSpeed: NATIVE_PORTAL_ACTOR_PROGRAM.childInitialHorizontalSpeed,
    verticalOffset: NATIVE_PORTAL_ACTOR_PROGRAM.childVerticalOffset,
    verticalVelocity: ejection.verticalVelocity,
  }
}

function validatePortalEjection(
  source: NonNullable<BoneyardEnemySpawnIntent['portalEjection']>,
): void {
  validatePoint(source.parentPosition, 'Portal ejection parent position')
  for (const [field, value] of Object.entries({
    childHeadingDeg: source.childHeadingDeg,
    inheritedPrimaryDamage: source.inheritedPrimaryDamage,
    parentHeadingDeg: source.parentHeadingDeg,
    verticalVelocity: source.verticalVelocity,
  })) {
    if (!Number.isFinite(value)) throw new RangeError(`Portal ejection ${field} must be finite`)
  }
  if (source.inheritedPrimaryDamage < 0 || source.verticalVelocity >= 0) {
    throw new RangeError('Portal ejection damage and vertical velocity are invalid')
  }
}

function createBrain(
  work: WorkingStep,
  config: EvaluatedBoneyardEnemyConfig,
  owner: Readonly<{
    cocoonTargetPlayerId?: string
    actorId: number
    facultyMemberCount: number
    headingDeg: number
    position: Readonly<BoneyardPoint>
    spawnTick: number
  }>,
): BoneyardEnemyBrain {
  switch (config.enemyToken) {
    case 'SPIDER': {
      const distance = drawNativeFloat(work.steeringRngState, 1)
      work.steeringRngState = distance.state
      return { ...createNativeSpiderState(distance.value), family: 'spider', phase: 'active' }
    }
    case 'COCOON': return {
      family: 'cocoon', phase: 'active', ownerPlayerId: owner.cocoonTargetPlayerId ?? null,
      ownerPosition: { x: owner.position.x, y: owner.position.y - 1 },
    }
    case 'DEMONSKULL': {
      const created = createNativeDemonSkull(work.steeringRngState, config.scale, config.family.capabilities)
      work.steeringRngState = created.rng
      return { ...created.state, actions: [], deathCountdown: 1000, family: 'demon-skull', phase: 'range-control' }
    }
    case 'DIREFACULTY': {
      const created = createNativeFaculty(work.steeringRngState)
      let rng = created.rng
      if (work.facultyVoiceController === null) {
        const controller = createNativeFacultyVoiceController(rng)
        work.facultyVoiceController = controller.state
        rng = controller.rng
      }
      const registered = registerNativeFaculty(created.state, rng, owner.facultyMemberCount)
      work.steeringRngState = registered.rng
      return { ...registered.state, bodyHeadingDeg: owner.headingDeg, family: 'faculty', phase: 'range-control' }
    }
    case 'HEARTMONGER': {
      const created = createNativeHeartmonger(work.steeringRngState, config.family.crowCount, work.nextDeathEffectId)
      work.steeringRngState = created.rng
      work.nextDeathEffectId += config.family.crowCount
      return { ...created.state, family: 'heartmonger', phase: 'approach', legPhase: 0, torsoPhase: 0 }
    }
    case 'SKELETON': return {
      action: skeletonAction(config.family.weapon),
      actionProgress: 0,
      contactTargetPlayerId: null,
      family: 'skeleton',
      markerEmitted: false,
      phase: 'approach',
    }
    case 'SKELETONARCHER': {
      const direction = drawNativeSign(work.steeringRngState, 1)
      const range = constructNativeRangedAttackRange(
        'archer',
        config.family.rangeMode,
        direction.state,
      )
      work.steeringRngState = range.rngState
      return {
        actionProgress: 0,
        aimSeed: 0,
        attackRange: range.range,
        family: 'archer',
        markerEmitted: false,
        phase: 'range-control',
        rangeEasyPending: range.rangeEasyPending,
        strafe: {
          direction: direction.value === -1 ? -1 : 1,
          limbHeadingDeg: owner.headingDeg,
          movementRamp: 0,
          turnBlend: 0,
        },
      }
    }
    case 'SKELETONMAGE': {
      const inheritedArcherRange = constructNativeRangedAttackRange(
        'archer',
        0,
        work.steeringRngState,
      )
      const range = constructNativeRangedAttackRange(
        'mage',
        config.family.rangeMode,
        inheritedArcherRange.rngState,
      )
      work.steeringRngState = range.rngState
      return {
        actionProgress: 0,
        attackRange: range.range,
        castProgram: 'short',
        castRoll: 0,
        disabledPrimaryTicks: 0,
        family: 'mage',
        lightningTargetPlayerId: null,
        lightningTargetPosition: null,
        lightningTicksRemaining: 0,
        markerEmitted: false,
        phase: 'range-control',
        rangeEasyPending: range.rangeEasyPending,
        shieldTicksRemaining: config.family.shieldInterval > 0
          ? boundedMageShieldIntervalTicks(config.family.shieldInterval)
          : 0,
      }
    }
    case 'IMP': {
      const flight = createNativeImpFlightState(
        () => drawUnit(work),
        config.baseSpeed,
      )
      return {
        ...flight,
        escapeHeadingDeg: null,
        family: 'imp',
        phase: 'flight',
        visualRngState: work.rngState,
      }
    }
    case 'PORTAL': return {
      ...createNativePortalState(config.family.frequency, () => drawUnit(work)),
      family: 'portal',
      hurtTicksRemaining: 0,
      phase: 'active',
    }
    case 'ZOMBIE': {
      const bodyPhaseDeg = drawUnit(work) * 360
      const headBaseRotationDeg = signedUnit(drawUnit(work)) * 65
      const headPhaseDeg = drawUnit(work) * 360
      drawInteger(work, 2) // Native +0x220 idle-turn timer seed.
      const rearArmBaseRotationDeg = drawUnit(work) * 20
      const frontArmBaseRotationDeg = drawUnit(work) * 20
      const attackSide = drawInteger(work, 2) as 0 | 1
      const bodyType = drawInteger(work, 3)
      const headRoll = drawInteger(work, 4)
      const headType = headRoll === 3 ? drawInteger(work, 2) + 1 : 0
      const configuredBodyType = config.family.bodyType === 3 ? 3 : bodyType
      const configuredHeadType = config.family.bodyType === 3 ? 3 : headType
      return {
        actionProgress: 0,
        actionRate: 0,
        actionSwing: 0,
        angularOffsetDeg: 0,
        attackSide,
        bodyPhaseDeg,
        bodyType: configuredBodyType,
        contactTargetPlayerId: null,
        family: 'zombie',
        frontArmBaseRotationDeg,
        headBaseRotationDeg,
        headPhaseDeg,
        headType: configuredHeadType,
        impactStateTicksRemaining: 0,
        markerEmitted: false,
        phase: 'approach',
        phaseTicksRemaining: 0,
        rearArmBaseRotationDeg,
        verticalOffset: 0,
        verticalVelocity: 0,
        visualRngState: work.rngState,
      }
    }
    case 'WRAITH': {
      drawUnit(work) // Constructor +0x214 visual phase.
      const restingSpeedUnit = drawUnit(work)
      const flybyTickOffset = drawInteger(work, NATIVE_WRAITH_FLYBY_TICKS.randomCount)
      const initialSpeedUnit = drawUnit(work)
      return {
        ...createNativeWraithFlightState(
          config.chaseSpeed,
          restingSpeedUnit,
          initialSpeedUnit,
          flybyTickOffset,
        ),
        family: 'wraith',
        phase: 'flight',
      }
    }
    case 'DEMON': return {
      actionProgress: 0,
      articulation: createNativeDemonArticulationState(
        owner.actorId,
        owner.spawnTick,
        owner.position,
        owner.headingDeg,
        config.scale,
      ),
      family: 'demon',
      markerEmitted: false,
      phase: 'approach',
    }
    case 'COFFIN': {
      const hidden = randomBoneyardWaveInteger(work.rngState, 2)
      work.rngState = hidden.state
      const initialGate = randomBoneyardWaveInteger(work.rngState, 50)
      work.rngState = initialGate.state
      const launchScale = drawUnit(work) < 0.5 ? -1 : 1
      const launchRotationDeg = signedUnit(drawUnit(work)) * 15
      return {
        family: 'coffin',
        launchRotationDeg,
        launchScale,
        maggotCharge: 0,
        phase: 'hidden',
        phaseTick: 0,
        phaseTicksRemaining: hidden.value === 0
          ? NATIVE_COFFIN_HIDDEN_SHORT_TICKS + initialGate.value
          : NATIVE_COFFIN_HIDDEN_LONG_TICKS + initialGate.value,
      }
    }
  }
}

export function spawnTerminalChildren(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.config.enemyToken === 'IMP') {
    const splitDepth = actor.config.family.splitDepth
    if (splitDepth === 0) return
    if (work.impActorCount > NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM) return
    const spawnIntents = NATIVE_IMP_SPLIT_HEADING_OFFSETS.map((): BoneyardEnemySpawnIntent => {
      const intent: BoneyardEnemySpawnIntent = {
        enemyToken: 'IMP',
        flags: [],
        id: work.nextSyntheticSpawnIntentId,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
        position: { ...actor.position },
        spawnTick: context.tick,
        waveOrdinal: actor.waveOrdinal,
      }
      work.nextSyntheticSpawnIntentId += 1
      return intent
    })
    const children = materializeSpawnIntents(
      work,
      context,
      spawnIntents,
      splitDepth - 1,
    ).map((child, index) => ({
      ...child,
      headingDeg: (
        (actor.headingDeg + NATIVE_IMP_SPLIT_HEADING_OFFSETS[index]!) % 360 + 360
      ) % 360,
    }))
    work.actors.push(...children)
    return
  }
  if (actor.config.enemyToken !== 'DEMON') return
  const count = actor.config.family.splitCount
  if (count === 0) return
  const radius = Math.max(10, actor.config.collisionRadius)
  const spawnIntents = Array.from({ length: count }, (_, index): BoneyardEnemySpawnIntent => {
    const angle = index / count * Math.PI * 2
    const intent: BoneyardEnemySpawnIntent = {
      enemyToken: 'IMP',
      flags: [],
      id: work.nextSyntheticSpawnIntentId,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      position: {
        x: actor.position.x + Math.cos(angle) * radius,
        y: actor.position.y + Math.sin(angle) * radius,
      },
      spawnTick: context.tick,
      waveOrdinal: actor.waveOrdinal,
    }
    work.nextSyntheticSpawnIntentId += 1
    return intent
  })
  work.actors.push(...materializeSpawnIntents(
    work,
    context,
    spawnIntents,
    0,
  ))
}

type ConstructionContext = Pick<BoneyardEnemyStoreStepContext,
  'arenaScalars' | 'players' | 'resolveMovement' | 'resolveSpawnPlacement' | 'rollLootSeed' | 'tick'>

export function addNativeCocoon(
  source: BoneyardEnemyStore,
  ownerPlayerId: string,
  position: Readonly<BoneyardPoint>,
  players: BoneyardEnemyTargets,
  tick: number,
  registerWorldPainter?: RegisterNativeWorldPainter,
): Readonly<{ store: BoneyardEnemyStore; events: readonly BoneyardEnemySemanticEvent[] }> {
  const work = createEnemyWork(source, { tick, registerWorldPainter }, true)
  work.actors.push(...materializeSpawnIntents(work, {
    players, tick, resolveMovement: ({ position: root }) => root,
  }, [{
    cocoonTargetPlayerId: ownerPlayerId,
    enemyToken: 'COCOON', flags: [], id: work.nextSyntheticSpawnIntentId++,
    nativeTypeId: 2058, locationPolicy: 'anywhere', positionPolicy: 'direct',
    position: { x: position.x, y: position.y + 1 }, spawnTick: tick, waveOrdinal: 0,
  }]))
  return { store: finishEnemyStore(work, source.lastStepTick), events: work.events }
}
