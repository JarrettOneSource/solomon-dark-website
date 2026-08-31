import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import type { BoneyardArenaTransitionState } from '../core-kernels/boneyard-arena-transition.ts'
import type { GameRunLifecycleState } from '../core-kernels/game-run.ts'
import { freezeNativeBelt } from '../core-kernels/native-belt.ts'
import {
  NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
} from '../core-kernels/boneyard-imp-flight.ts'
import { NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES } from '../core-kernels/boneyard-mage-lightning.ts'
import type {
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
  BoneyardGoodieSnapshot,
  BoneyardLootEventSnapshot,
  BoneyardLootSnapshot,
  BoneyardMaggotSnapshot,
  BoneyardSolomonSnapshot,
  BoneyardWaveSnapshot,
  BoneyardWorldSnapshot,
  GameSnapshot,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import { lerpCycle } from './hub-presentation-timeline.ts'
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'
import {
  copyNativeSecondaryState,
  interpolateNativeSecondaryState,
} from './native-secondary-presentation.ts'

export type BoneyardGameSnapshot = Omit<GameSnapshot, 'world'> & {
  world: BoneyardWorldSnapshot
}

export interface BoneyardPresentationFrame extends Omit<BoneyardGameSnapshot, 'tick'> {
  tick: number
}

export interface BoneyardPresentationTimeline {
  latest(): BoneyardGameSnapshot
  push(snapshot: BoneyardGameSnapshot, receivedAtMs: number): void
  sample(nowMs: number): BoneyardPresentationFrame
}

export interface BoneyardPresentationTimelineOptions {
  initialReceivedAtMs: number
  initialSnapshot: BoneyardGameSnapshot
  serverTickRate: number
  snapshotRate: number
}

interface TimedSnapshot {
  receivedAtMs: number
  snapshot: BoneyardGameSnapshot
}

const MAX_BUFFERED_SNAPSHOTS = 8
const WALK_FRAME_COUNT = 5
const ENEMY_GAIT_POSE_COUNT = 8
const SOLOMON_WALK_FRAME_COUNT = 6
const HEADING_COUNT = 24
const FULL_CIRCLE = 360
const GUIDED_MISSILE_VISUAL_PHASE_PERIOD = 720

export function createBoneyardPresentationTimeline(
  options: BoneyardPresentationTimelineOptions,
): BoneyardPresentationTimeline {
  requirePositiveFinite(options.serverTickRate, 'serverTickRate')
  requirePositiveFinite(options.snapshotRate, 'snapshotRate')
  requireFinite(options.initialReceivedAtMs, 'initialReceivedAtMs')
  const intervalTicks = Math.max(1, options.serverTickRate / options.snapshotRate)
  const history: TimedSnapshot[] = [{
    receivedAtMs: options.initialReceivedAtMs,
    snapshot: options.initialSnapshot,
  }]

  return {
    latest: () => history.at(-1)!.snapshot,
    push(snapshot, receivedAtMs) {
      requireFinite(receivedAtMs, 'receivedAtMs')
      const latest = history.at(-1)!
      if (snapshot.tick < latest.snapshot.tick) return
      if (snapshot.tick === latest.snapshot.tick) {
        history[history.length - 1] = {
          receivedAtMs: latest.receivedAtMs,
          snapshot,
        }
        return
      }
      history.push({ receivedAtMs, snapshot })
      if (history.length > MAX_BUFFERED_SNAPSHOTS) history.shift()
    },
    sample(nowMs) {
      requireFinite(nowMs, 'nowMs')
      const newest = history.at(-1)!
      if (history.length === 1) return presentationCopy(newest.snapshot)
      const elapsedTicks = clamp(
        (nowMs - newest.receivedAtMs) * options.serverTickRate / 1000,
        0,
        intervalTicks,
      )
      const targetTick = newest.snapshot.tick - intervalTicks + elapsedTicks
      const [older, newer] = bracketSnapshots(history, targetTick)
      const span = newer.snapshot.tick - older.snapshot.tick
      const blend = span <= 0 ? 1 : clamp(
        (targetTick - older.snapshot.tick) / span,
        0,
        1,
      )
      return interpolateSnapshot(older.snapshot, newer.snapshot, blend, targetTick)
    },
  }
}

export function isBoneyardGameSnapshot(
  snapshot: GameSnapshot,
): snapshot is BoneyardGameSnapshot {
  return snapshot.world.kind === 'boneyard'
}

function bracketSnapshots(
  history: readonly TimedSnapshot[],
  targetTick: number,
): readonly [TimedSnapshot, TimedSnapshot] {
  if (targetTick <= history[0].snapshot.tick) return [history[0], history[0]]
  for (let index = 1; index < history.length; index += 1) {
    if (targetTick <= history[index].snapshot.tick) return [history[index - 1], history[index]]
  }
  const latest = history.at(-1)!
  return [latest, latest]
}

function interpolateSnapshot(
  older: BoneyardGameSnapshot,
  newer: BoneyardGameSnapshot,
  blend: number,
  targetTick: number,
): BoneyardPresentationFrame {
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [playerId, olderPlayer] of Object.entries(older.players)) {
    const newerPlayer = newer.players[playerId]
    players[playerId] = newerPlayer
      ? interpolatePlayer(olderPlayer, newerPlayer, blend)
      : copyPlayer(olderPlayer)
  }
  if (blend >= 1) {
    for (const [playerId, newerPlayer] of Object.entries(newer.players)) {
      if (!players[playerId]) players[playerId] = copyPlayer(newerPlayer)
    }
  }
  return {
    hostPlayerId: blend < 1 ? older.hostPlayerId : newer.hostPlayerId,
    levelUpBarrier: blend < 1 ? older.levelUpBarrier : newer.levelUpBarrier,
    materializingPlayerIds: blend < 1
      ? older.materializingPlayerIds
      : newer.materializingPlayerIds,
    modEffects: blend < 1 ? older.modEffects : newer.modEffects,
    players,
    primarySpells: interpolatePrimarySpellState(
      older.primarySpells,
      newer.primarySpells,
      blend,
      { newerTick: newer.tick, olderTick: older.tick, targetTick },
    ),
    secondaryAbilities: interpolateNativeSecondaryState(
      older.secondaryAbilities,
      newer.secondaryAbilities,
      blend,
    ),
    run: interpolateGameRunLifecycle(older.run, newer.run, blend),
    tick: clamp(targetTick, older.tick, newer.tick),
    world: {
      arenaTransition: interpolateArenaTransition(
        older.world.arenaTransition,
        newer.world.arenaTransition,
        blend,
      ),
      deathEffects: interpolateEnemyDeathEffects(
        older.world.deathEffects,
        newer.world.deathEffects,
        blend,
      ),
      encounter: interpolateSolomon(
        older.world.encounter,
        newer.world.encounter,
        blend,
      ),
      enemies: interpolateEnemies(older.world.enemies, newer.world.enemies, blend),
      enemyEvents: (blend < 1 ? older.world.enemyEvents : newer.world.enemyEvents)
        .map(copyEnemyEvent),
      enemyWorldFeedback: {
        ...(blend < 1 ? older : newer).world.enemyWorldFeedback,
      },
      enemyProjectileEffects: interpolateEnemyProjectileEffects(
        older.world.enemyProjectileEffects,
        newer.world.enemyProjectileEffects,
        blend,
      ),
      enemyProjectiles: interpolateEnemyProjectiles(
        older.world.enemyProjectiles,
        newer.world.enemyProjectiles,
        blend,
      ),
      gateLeaves: interpolateGateLeaves(
        older.world.gateLeaves,
        newer.world.gateLeaves,
        blend,
      ),
      goodies: (blend < 1 ? older.world.goodies : newer.world.goodies)
        .map(copyGoodie),
      hallOfFameRuns: copyHallOfFameRuns(
        (blend < 1 ? older : newer).world.hallOfFameRuns,
      ),
      kind: 'boneyard',
      lanternLightRegistration: copyLightRegistration(
        (blend < 1 ? older : newer).world.lanternLightRegistration,
      ),
      loot: interpolateLoot(older.world.loot, newer.world.loot, blend),
      lootEvents: (blend < 1 ? older.world.lootEvents : newer.world.lootEvents)
        .map(copyLootEvent),
      mageLightningPulses: mergeMageLightningPulses(
        older.world.mageLightningPulses,
        newer.world.mageLightningPulses,
        targetTick,
      ),
      maggots: interpolateMaggots(older.world.maggots, newer.world.maggots, blend),
      runId: newer.world.runId,
      solomonPainterRegistration: copyLightRegistration(
        (blend < 1 ? older : newer).world.solomonPainterRegistration,
      ),
      tutorial: interpolateTutorial(
        older.world.tutorial,
        newer.world.tutorial,
        blend,
      ),
      waves: interpolateWaves(older.world.waves, newer.world.waves, blend),
    },
  }
}

function interpolateGameRunLifecycle(
  older: GameRunLifecycleState,
  newer: GameRunLifecycleState,
  blend: number,
): GameRunLifecycleState {
  const discrete = blend < 1 ? older : newer
  const sameGameOver = older.phase === 'game-over'
    && newer.phase === 'game-over'
    && older.runId === newer.runId
    && older.gameOverEventId === newer.gameOverEventId
  if (!sameGameOver) return discrete
  return {
    ...discrete,
    gameOverExitTicks: older.gameOverExitTicks !== null
      && newer.gameOverExitTicks !== null
      ? Math.floor(lerp(older.gameOverExitTicks, newer.gameOverExitTicks, blend))
      : discrete.gameOverExitTicks,
    gameOverTicks: Math.floor(lerp(older.gameOverTicks, newer.gameOverTicks, blend)),
  }
}

function interpolatePlayer(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState {
  const discrete = blend < 1 ? older : newer
  return {
    belt: discrete.belt,
    config: { ...discrete.config },
    economy: discrete.economy,
    footstepTick: discrete.footstepTick,
    gaitDegrees: lerpCycle(older.gaitDegrees, newer.gaitDegrees, blend, FULL_CIRCLE),
    headingIndex: Math.round(lerpCycle(
      older.headingIndex,
      newer.headingIndex,
      blend,
      HEADING_COUNT,
    )) % HEADING_COUNT,
    lighting: {
      ...discrete.lighting,
      deathWeaponPainterRegistration:
        discrete.lighting.deathWeaponPainterRegistration === null
          ? null
          : { ...discrete.lighting.deathWeaponPainterRegistration },
      lightRegistration: { ...discrete.lighting.lightRegistration },
      overlayEffectPhase: lerp(
        older.lighting.overlayEffectPhase,
        newer.lighting.overlayEffectPhase,
        blend,
      ),
    },
    movementScale: discrete.movementScale,
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    primaryCast: {
      ...discrete.primaryCast,
      aimDirection: { ...discrete.primaryCast.aimDirection },
      etherBlastCharge: lerp(
        older.primaryCast.etherBlastCharge,
        newer.primaryCast.etherBlastCharge,
        blend,
      ),
      weaponPulse: lerp(
        older.primaryCast.weaponPulse,
        newer.primaryCast.weaponPulse,
        blend,
      ),
    },
    progression: interpolatePlayerProgression(older, newer, blend),
    velocity: {
      x: lerp(older.velocity.x, newer.velocity.x, blend),
      y: lerp(older.velocity.y, newer.velocity.y, blend),
    },
    walkCyclePrimary: lerpCycle(
      older.walkCyclePrimary,
      newer.walkCyclePrimary,
      blend,
      WALK_FRAME_COUNT,
    ),
  }
}

function interpolatePlayerProgression(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState['progression'] {
  const first = older.progression
  const second = newer.progression
  const discrete = blend < 1 ? first : second
  const sameDeathEpoch = first.deathEpoch === second.deathEpoch
    && (first.lifeState === 'dying' || first.lifeState === 'spectating')
    && (second.lifeState === 'dying' || second.lifeState === 'spectating')
  const damageX4Delta = first.damageX4TicksRemaining - second.damageX4TicksRemaining
  const damageX4TicksRemaining = first.damageX4TicksRemaining > 0
    && second.damageX4TicksRemaining > 0
    && damageX4Delta >= 0
    && damageX4Delta <= 10
    ? lerp(first.damageX4TicksRemaining, second.damageX4TicksRemaining, blend)
    : discrete.damageX4TicksRemaining
  return {
    ...discrete,
    damageX4TicksRemaining,
    ...(sameDeathEpoch
      ? { deathTick: Math.floor(lerp(first.deathTick, second.deathTick, blend)) }
      : {}),
  }
}

function interpolateGateLeaves(
  older: readonly BoneyardGateLeafSnapshot[],
  newer: readonly BoneyardGateLeafSnapshot[],
  blend: number,
): BoneyardGateLeafSnapshot[] {
  const newerById = new Map(newer.map((leaf) => [leaf.id, leaf]))
  const leaves = older.map((olderLeaf) => {
    const newerLeaf = newerById.get(olderLeaf.id)
    if (!newerLeaf) return copyGateLeaf(olderLeaf)
    return {
      fenceEid: blend < 1 ? olderLeaf.fenceEid : newerLeaf.fenceEid,
      hinge: {
        x: lerp(olderLeaf.hinge.x, newerLeaf.hinge.x, blend),
        y: lerp(olderLeaf.hinge.y, newerLeaf.hinge.y, blend),
      },
      id: olderLeaf.id,
      side: blend < 1 ? olderLeaf.side : newerLeaf.side,
      tip: {
        x: lerp(olderLeaf.tip.x, newerLeaf.tip.x, blend),
        y: lerp(olderLeaf.tip.y, newerLeaf.tip.y, blend),
      },
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(leaves.map((leaf) => leaf.id))
    for (const newerLeaf of newer) {
      if (!knownIds.has(newerLeaf.id)) leaves.push(copyGateLeaf(newerLeaf))
    }
    return leaves.filter((leaf) => newerById.has(leaf.id))
  }
  return leaves
}

function presentationCopy(snapshot: BoneyardGameSnapshot): BoneyardPresentationFrame {
  return {
    hostPlayerId: snapshot.hostPlayerId,
    levelUpBarrier: snapshot.levelUpBarrier,
    materializingPlayerIds: snapshot.materializingPlayerIds,
    modEffects: snapshot.modEffects,
    players: Object.fromEntries(Object.entries(snapshot.players).map(([id, player]) => [
      id,
      copyPlayer(player),
    ])),
    primarySpells: copyPrimarySpellState(snapshot.primarySpells),
    secondaryAbilities: copyNativeSecondaryState(snapshot.secondaryAbilities),
    run: snapshot.run,
    tick: snapshot.tick,
    world: {
      arenaTransition: copyArenaTransition(snapshot.world.arenaTransition),
      deathEffects: snapshot.world.deathEffects.map(copyEnemyDeathEffect),
      encounter: copySolomon(snapshot.world.encounter),
      enemies: snapshot.world.enemies.map(copyEnemy),
      enemyEvents: snapshot.world.enemyEvents.map(copyEnemyEvent),
      enemyWorldFeedback: { ...snapshot.world.enemyWorldFeedback },
      enemyProjectileEffects: snapshot.world.enemyProjectileEffects
        .map(copyEnemyProjectileEffect),
      enemyProjectiles: snapshot.world.enemyProjectiles.map(copyEnemyProjectile),
      gateLeaves: snapshot.world.gateLeaves.map(copyGateLeaf),
      goodies: snapshot.world.goodies.map(copyGoodie),
      hallOfFameRuns: copyHallOfFameRuns(snapshot.world.hallOfFameRuns),
      kind: 'boneyard',
      lanternLightRegistration: copyLightRegistration(
        snapshot.world.lanternLightRegistration,
      ),
      loot: snapshot.world.loot.map(copyLoot),
      lootEvents: snapshot.world.lootEvents.map(copyLootEvent),
      mageLightningPulses: mergeMageLightningPulses(
        snapshot.world.mageLightningPulses,
        [],
        snapshot.tick,
      ),
      maggots: snapshot.world.maggots.map(copyMaggot),
      runId: snapshot.world.runId,
      solomonPainterRegistration: copyLightRegistration(
        snapshot.world.solomonPainterRegistration,
      ),
      tutorial: copyTutorial(snapshot.world.tutorial),
      waves: copyWaves(snapshot.world.waves),
    },
  }
}

function copyTutorial(
  source: BoneyardGameSnapshot['world']['tutorial'],
): BoneyardGameSnapshot['world']['tutorial'] {
  if (source === null) return null
  return {
    ...source,
    movementAnchor: { ...source.movementAnchor },
    narration: {
      ...source.narration,
      current: source.narration.current === null
        ? null
        : { ...source.narration.current },
      pending: [...source.narration.pending],
    },
    survivalLastCheckedTicks: [...source.survivalLastCheckedTicks],
  }
}

function interpolateTutorial(
  older: BoneyardGameSnapshot['world']['tutorial'],
  newer: BoneyardGameSnapshot['world']['tutorial'],
  blend: number,
): BoneyardGameSnapshot['world']['tutorial'] {
  if (older === null || newer === null) {
    return copyTutorial(blend < 1 ? older : newer)
  }
  const discrete = copyTutorial(blend < 1 ? older : newer)!
  if (!older.cameraLockTriggered || !newer.cameraLockTriggered) return discrete
  return {
    ...discrete,
    cameraLockAgeTicks: lerp(
      older.cameraLockAgeTicks,
      newer.cameraLockAgeTicks,
      blend,
    ),
  }
}

function copyHallOfFameRuns(
  source: BoneyardGameSnapshot['world']['hallOfFameRuns'],
): BoneyardGameSnapshot['world']['hallOfFameRuns'] {
  return Object.fromEntries(Object.entries(source).map(([playerId, run]) => [
    playerId,
    { ...run },
  ]))
}

function interpolateLoot(
  older: readonly BoneyardLootSnapshot[],
  newer: readonly BoneyardLootSnapshot[],
  blend: number,
): readonly BoneyardLootSnapshot[] {
  const newerById = new Map(newer.map((actor) => [actor.id, actor]))
  const actors = older.map((source) => {
    const target = newerById.get(source.id)
    if (target === undefined || source.kind !== target.kind) return copyLoot(source)
    const discrete = blend < 1 ? source : target
    return {
      ...discrete,
      alpha: lerp(source.alpha, target.alpha, blend),
      animationPhase: lerpCycle(source.animationPhase, target.animationPhase, blend, 360),
      bounceHeight: lerp(source.bounceHeight, target.bounceHeight, blend),
      framePhase: lerpCycle(source.framePhase, target.framePhase, blend, 18),
      position: {
        x: lerp(source.position.x, target.position.x, blend),
        y: lerp(source.position.y, target.position.y, blend),
      },
      rotationDeg: lerpCycle(source.rotationDeg, target.rotationDeg, blend, 360),
      scatterProgress: lerp(source.scatterProgress, target.scatterProgress, blend),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(actors.map(({ id }) => id))
    for (const actor of newer) {
      if (!knownIds.has(actor.id)) actors.push(copyLoot(actor))
    }
    return actors.filter(({ id }) => newerById.has(id))
  }
  return actors
}

function copyLoot(source: BoneyardLootSnapshot): BoneyardLootSnapshot {
  return {
    ...source,
    painterRegistration: { ...source.painterRegistration },
    position: { ...source.position },
  }
}

function copyGoodie(source: BoneyardGoodieSnapshot): BoneyardGoodieSnapshot {
  return { ...source, position: { ...source.position } }
}

function copyLootEvent(source: BoneyardLootEventSnapshot): BoneyardLootEventSnapshot {
  return { ...source, position: { ...source.position } }
}

function interpolateArenaTransition(
  older: BoneyardArenaTransitionState | null,
  newer: BoneyardArenaTransitionState | null,
  blend: number,
): BoneyardArenaTransitionState | null {
  if (older === null || newer === null) {
    return copyArenaTransition(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return {
    ...discrete,
    blendFactor: lerp(older.blendFactor, newer.blendFactor, blend),
    cameraBounds: {
      h: lerp(older.cameraBounds.h, newer.cameraBounds.h, blend),
      w: lerp(older.cameraBounds.w, newer.cameraBounds.w, blend),
      x: lerp(older.cameraBounds.x, newer.cameraBounds.x, blend),
      y: lerp(older.cameraBounds.y, newer.cameraBounds.y, blend),
    },
    combatBounds: { ...discrete.combatBounds },
    fullBounds: { ...discrete.fullBounds },
  }
}

function copyArenaTransition(
  source: BoneyardArenaTransitionState | null,
): BoneyardArenaTransitionState | null {
  return source === null
    ? null
    : {
        ...source,
        cameraBounds: { ...source.cameraBounds },
        combatBounds: { ...source.combatBounds },
        fullBounds: { ...source.fullBounds },
      }
}

function interpolateEnemyDeathEffects(
  older: readonly BoneyardEnemyDeathEffectSnapshot[],
  newer: readonly BoneyardEnemyDeathEffectSnapshot[],
  blend: number,
): BoneyardEnemyDeathEffectSnapshot[] {
  const newerById = new Map(newer.map((effect) => [effect.id, effect]))
  const effects = older.map((olderEffect) => {
    const newerEffect = newerById.get(olderEffect.id)
    if (!newerEffect) return copyEnemyDeathEffect(olderEffect)
    const discrete = blend < 1 ? olderEffect : newerEffect
    return {
      ...copyEnemyDeathEffect(discrete),
      ageTicks: lerp(olderEffect.ageTicks, newerEffect.ageTicks, blend),
      alpha: lerp(olderEffect.alpha, newerEffect.alpha, blend),
      height: lerp(olderEffect.height, newerEffect.height, blend),
      position: {
        x: lerp(olderEffect.position.x, newerEffect.position.x, blend),
        y: lerp(olderEffect.position.y, newerEffect.position.y, blend),
      },
      rotationRadians: lerpCycle(
        olderEffect.rotationRadians,
        newerEffect.rotationRadians,
        blend,
        Math.PI * 2,
      ),
      scale: lerp(olderEffect.scale, newerEffect.scale, blend),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(effects.map((effect) => effect.id))
    for (const effect of newer) {
      if (!knownIds.has(effect.id)) effects.push(copyEnemyDeathEffect(effect))
    }
    return effects.filter((effect) => newerById.has(effect.id))
  }
  return effects
}

function interpolateEnemyProjectiles(
  older: readonly BoneyardEnemyProjectileSnapshot[],
  newer: readonly BoneyardEnemyProjectileSnapshot[],
  blend: number,
): BoneyardEnemyProjectileSnapshot[] {
  const newerById = new Map(newer.map((projectile) => [projectile.id, projectile]))
  const projectiles = older.map((olderProjectile) => {
    const newerProjectile = newerById.get(olderProjectile.id)
    if (!newerProjectile) return copyEnemyProjectile(olderProjectile)
    const discrete = blend < 1 ? olderProjectile : newerProjectile
    return {
      ...copyEnemyProjectile(discrete),
      ageTicks: lerp(olderProjectile.ageTicks, newerProjectile.ageTicks, blend),
      headingDeg: lerpCycle(
        olderProjectile.headingDeg,
        newerProjectile.headingDeg,
        blend,
        FULL_CIRCLE,
      ),
      position: {
        x: lerp(olderProjectile.position.x, newerProjectile.position.x, blend),
        y: lerp(olderProjectile.position.y, newerProjectile.position.y, blend),
      },
      speed: lerp(olderProjectile.speed, newerProjectile.speed, blend),
      verticalOffset: lerp(
        olderProjectile.verticalOffset,
        newerProjectile.verticalOffset,
        blend,
      ),
      visualPhaseDeg: lerpCycle(
        olderProjectile.visualPhaseDeg,
        newerProjectile.visualPhaseDeg,
        blend,
        olderProjectile.kind === 'guided-missile'
          ? GUIDED_MISSILE_VISUAL_PHASE_PERIOD
          : FULL_CIRCLE,
      ),
      visualScale: lerp(
        olderProjectile.visualScale,
        newerProjectile.visualScale,
        blend,
      ),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(projectiles.map((projectile) => projectile.id))
    for (const projectile of newer) {
      if (!knownIds.has(projectile.id)) projectiles.push(copyEnemyProjectile(projectile))
    }
    return projectiles.filter((projectile) => newerById.has(projectile.id))
  }
  return projectiles
}

function interpolateEnemyProjectileEffects(
  older: readonly BoneyardEnemyProjectileEffectSnapshot[],
  newer: readonly BoneyardEnemyProjectileEffectSnapshot[],
  blend: number,
): BoneyardEnemyProjectileEffectSnapshot[] {
  const newerById = new Map(newer.map((effect) => [effect.id, effect]))
  const effects = older.map((olderEffect) => {
    const newerEffect = newerById.get(olderEffect.id)
    if (!newerEffect) return copyEnemyProjectileEffect(olderEffect)
    const discrete = blend < 1 ? olderEffect : newerEffect
    return {
      ...copyEnemyProjectileEffect(discrete),
      ageTicks: lerp(olderEffect.ageTicks, newerEffect.ageTicks, blend),
      alpha: lerp(olderEffect.alpha, newerEffect.alpha, blend),
      position: {
        x: lerp(olderEffect.position.x, newerEffect.position.x, blend),
        y: lerp(olderEffect.position.y, newerEffect.position.y, blend),
      },
      rotationRadians: lerpCycle(
        olderEffect.rotationRadians,
        newerEffect.rotationRadians,
        blend,
        Math.PI * 2,
      ),
      scale: lerp(olderEffect.scale, newerEffect.scale, blend),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(effects.map((effect) => effect.id))
    for (const effect of newer) {
      if (!knownIds.has(effect.id)) effects.push(copyEnemyProjectileEffect(effect))
    }
    return effects.filter((effect) => newerById.has(effect.id))
  }
  return effects
}

function interpolateMaggots(
  older: readonly BoneyardMaggotSnapshot[],
  newer: readonly BoneyardMaggotSnapshot[],
  blend: number,
): BoneyardMaggotSnapshot[] {
  const newerById = new Map(newer.map((maggot) => [maggot.id, maggot]))
  const maggots = older.map((olderMaggot) => {
    const newerMaggot = newerById.get(olderMaggot.id)
    if (!newerMaggot) return copyMaggot(olderMaggot)
    const discrete = blend < 1 ? olderMaggot : newerMaggot
    return {
      ...copyMaggot(discrete),
      alpha: lerp(olderMaggot.alpha, newerMaggot.alpha, blend),
      currentHealth: lerp(olderMaggot.currentHealth, newerMaggot.currentHealth, blend),
      deathTick: lerp(olderMaggot.deathTick, newerMaggot.deathTick, blend),
      emergencePhase: lerpCycle(
        olderMaggot.emergencePhase,
        newerMaggot.emergencePhase,
        blend,
        5,
      ),
      emergenceTick: lerp(olderMaggot.emergenceTick, newerMaggot.emergenceTick, blend),
      headingDeg: lerpCycle(olderMaggot.headingDeg, newerMaggot.headingDeg, blend, FULL_CIRCLE),
      hitFlash: lerp(olderMaggot.hitFlash, newerMaggot.hitFlash, blend),
      pose: lerpCycle(olderMaggot.pose, newerMaggot.pose, blend, 2),
      position: {
        x: lerp(olderMaggot.position.x, newerMaggot.position.x, blend),
        y: lerp(olderMaggot.position.y, newerMaggot.position.y, blend),
      },
      verticalOffset: lerp(
        olderMaggot.verticalOffset,
        newerMaggot.verticalOffset,
        blend,
      ),
      visualScale: lerp(
        olderMaggot.visualScale,
        newerMaggot.visualScale,
        blend,
      ),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(maggots.map((maggot) => maggot.id))
    for (const maggot of newer) {
      if (!knownIds.has(maggot.id)) maggots.push(copyMaggot(maggot))
    }
    return maggots.filter((maggot) => newerById.has(maggot.id))
  }
  return maggots
}

function copyPlayer(player: ProtocolPlayerState): ProtocolPlayerState {
  return {
    ...player,
    belt: freezeNativeBelt(player.belt.map((entry) => entry && { ...entry })),
    config: { ...player.config },
    lighting: {
      ...player.lighting,
      deathWeaponPainterRegistration:
        player.lighting.deathWeaponPainterRegistration === null
          ? null
          : { ...player.lighting.deathWeaponPainterRegistration },
      lightRegistration: { ...player.lighting.lightRegistration },
    },
    position: { ...player.position },
    primaryCast: {
      ...player.primaryCast,
      aimDirection: { ...player.primaryCast.aimDirection },
    },
    progression: {
      ...player.progression,
      hagathaRuntime: { ...player.progression.hagathaRuntime },
      learnedSkills: player.progression.learnedSkills.map((entry) => [...entry]),
      secondaryManaCosts: player.progression.secondaryManaCosts.map((entry) => [...entry]),
      weldComponentRanks: player.progression.weldComponentRanks === null
        ? null
        : [...player.progression.weldComponentRanks],
    },
    velocity: { ...player.velocity },
  }
}

function copyGateLeaf(leaf: BoneyardGateLeafSnapshot): BoneyardGateLeafSnapshot {
  return {
    ...leaf,
    hinge: { ...leaf.hinge },
    tip: { ...leaf.tip },
  }
}

function interpolateSolomon(
  older: BoneyardSolomonSnapshot | null,
  newer: BoneyardSolomonSnapshot | null,
  blend: number,
): BoneyardSolomonSnapshot | null {
  if (older === null || newer === null) {
    return copySolomon(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return {
    ...copySolomon(discrete)!,
    acceleration: lerp(older.acceleration, newer.acceleration, blend),
    headingDeg: lerpCycle(older.headingDeg, newer.headingDeg, blend, FULL_CIRCLE),
    motion: lerp(older.motion, newer.motion, blend),
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    transitionOffsetY: lerp(
      older.transitionOffsetY,
      newer.transitionOffsetY,
      blend,
    ),
    walkCycle: lerpCycle(
      older.walkCycle,
      newer.walkCycle,
      blend,
      SOLOMON_WALK_FRAME_COUNT,
    ),
  }
}

function interpolateWaves(
  older: BoneyardWaveSnapshot | null,
  newer: BoneyardWaveSnapshot | null,
  blend: number,
): BoneyardWaveSnapshot | null {
  if (older === null || newer === null) {
    return copyWaves(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return copyWaves(discrete)
}

function interpolateEnemies(
  older: readonly BoneyardEnemySnapshot[],
  newer: readonly BoneyardEnemySnapshot[],
  blend: number,
): BoneyardEnemySnapshot[] {
  const newerById = new Map(newer.map((enemy) => [enemy.id, enemy]))
  const enemies = older.map((olderEnemy) => {
    const newerEnemy = newerById.get(olderEnemy.id)
    if (!newerEnemy) return copyEnemy(olderEnemy)
    const discrete = blend < 1 ? olderEnemy : newerEnemy
    return {
      ...copyEnemy(discrete),
      animation: interpolateEnemyAnimation(olderEnemy, newerEnemy, blend),
      currentHealth: lerp(olderEnemy.currentHealth, newerEnemy.currentHealth, blend),
      headingDeg: lerpCycle(
        olderEnemy.headingDeg,
        newerEnemy.headingDeg,
        blend,
        FULL_CIRCLE,
      ),
      position: {
        x: lerp(olderEnemy.position.x, newerEnemy.position.x, blend),
        y: lerp(olderEnemy.position.y, newerEnemy.position.y, blend),
      },
      shieldHealth: lerp(olderEnemy.shieldHealth, newerEnemy.shieldHealth, blend),
      shieldMaximumHealth: lerp(
        olderEnemy.shieldMaximumHealth,
        newerEnemy.shieldMaximumHealth,
        blend,
      ),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(enemies.map((enemy) => enemy.id))
    for (const enemy of newer) {
      if (!knownIds.has(enemy.id)) enemies.push(copyEnemy(enemy))
    }
    return enemies.filter((enemy) => newerById.has(enemy.id))
  }
  return enemies
}

function copySolomon(
  encounter: BoneyardSolomonSnapshot | null,
): BoneyardSolomonSnapshot | null {
  return encounter === null ? null : {
    ...encounter,
    digEvents: encounter.digEvents.map((event) => ({ ...event })),
    position: { ...encounter.position },
    voiceEvents: encounter.voiceEvents.map((event) => ({ ...event })),
  }
}

function copyWaves(waves: BoneyardWaveSnapshot | null): BoneyardWaveSnapshot | null {
  return waves === null ? null : { ...waves }
}

function copyEnemy(enemy: BoneyardEnemySnapshot): BoneyardEnemySnapshot {
  return {
    ...enemy,
    animation: {
      ...enemy.animation,
      demonFrontExtremityOffset: { ...enemy.animation.demonFrontExtremityOffset },
      demonRearExtremityOffset: { ...enemy.animation.demonRearExtremityOffset },
      effects: enemy.animation.effects.map(copyEnemyEffect),
      maggots: [],
    },
    flags: [...enemy.flags],
    lightRegistration: copyLightRegistration(enemy.lightRegistration),
    lighting: { ...enemy.lighting },
    position: { ...enemy.position },
  }
}

function copyEnemyProjectile(
  projectile: BoneyardEnemyProjectileSnapshot,
): BoneyardEnemyProjectileSnapshot {
  return {
    ...projectile,
    lightRegistration: copyLightRegistration(projectile.lightRegistration),
    painterRegistration: { ...projectile.painterRegistration },
    position: { ...projectile.position },
  }
}

function copyLightRegistration<T extends { managerLane: 'actor' | 'transient'; registrationOrdinal: number } | null>(
  registration: T,
): T {
  return (registration === null ? null : { ...registration }) as T
}

function copyEnemyProjectileEffect(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): BoneyardEnemyProjectileEffectSnapshot {
  return {
    ...effect,
    lightRegistration: effect.lightRegistration === null
      ? null
      : { ...effect.lightRegistration },
    painterRegistration: { ...effect.painterRegistration },
    position: { ...effect.position },
  }
}

function copyEnemyDeathEffect(
  effect: BoneyardEnemyDeathEffectSnapshot,
): BoneyardEnemyDeathEffectSnapshot {
  return {
    ...effect,
    painterRegistration: effect.painterRegistration === null
      ? null
      : { ...effect.painterRegistration },
    position: { ...effect.position },
  }
}

function copyMaggot(maggot: BoneyardMaggotSnapshot): BoneyardMaggotSnapshot {
  return {
    ...maggot,
    lightRegistration: { ...maggot.lightRegistration },
    position: { ...maggot.position },
  }
}

function copyEnemyEvent(
  event: BoneyardWorldSnapshot['enemyEvents'][number],
): BoneyardWorldSnapshot['enemyEvents'][number] {
  return {
    ...event,
    ...(event.sourcePosition === undefined
      ? {}
      : { sourcePosition: { ...event.sourcePosition } }),
  }
}

function mergeMageLightningPulses(
  older: BoneyardWorldSnapshot['mageLightningPulses'],
  newer: BoneyardWorldSnapshot['mageLightningPulses'],
  presentationTick: number,
): BoneyardWorldSnapshot['mageLightningPulses'] {
  const pulses = new Map<number, BoneyardWorldSnapshot['mageLightningPulses'][number]>()
  for (const pulse of [...older, ...newer]) {
    if (
      pulse.tick > presentationTick
      || presentationTick - pulse.tick >= NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
    ) continue
    pulses.set(pulse.id, pulse)
  }
  return [...pulses.values()]
    .sort((first, second) => first.tick - second.tick || first.id - second.id)
    .map(copyMageLightningPulse)
}

function copyMageLightningPulse(
  pulse: BoneyardWorldSnapshot['mageLightningPulses'][number],
): BoneyardWorldSnapshot['mageLightningPulses'][number] {
  return {
    ...pulse,
    contact: pulse.contact.kind === 'world'
      ? { kind: 'world', position: { ...pulse.contact.position } }
      : {
          kind: 'target-attached',
          localOffset: { ...pulse.contact.localOffset },
          targetPlayerId: pulse.contact.targetPlayerId,
        },
    endpoint: { ...pulse.endpoint },
    midpoint: { ...pulse.midpoint },
    painterRegistrations: pulse.painterRegistrations.map((registration) => ({
      ...registration,
    })),
    source: { ...pulse.source },
  }
}

function copyEnemyEffect(
  effect: BoneyardEnemySnapshot['animation']['effects'][number],
): BoneyardEnemySnapshot['animation']['effects'][number] {
  return { ...effect, offset: { ...effect.offset } }
}

function interpolateEnemyAnimation(
  older: BoneyardEnemySnapshot,
  newer: BoneyardEnemySnapshot,
  blend: number,
): BoneyardEnemySnapshot['animation'] {
  const first = older.animation
  const second = newer.animation
  const discrete = blend < 1 ? first : second
  const sameProgram = first.state === second.state
    && first.action === second.action
    && first.deathEpoch === second.deathEpoch
  if (!sameProgram) return copyEnemy(blend < 1 ? older : newer).animation
  return {
    ...discrete,
    actionProgress: lerp(first.actionProgress, second.actionProgress, blend),
    alpha: lerp(first.alpha, second.alpha, blend),
    bodyPose: discrete.bodyPose,
    coffinPose: lerp(first.coffinPose, second.coffinPose, blend),
    coffinRotationRadians: lerp(
      first.coffinRotationRadians,
      second.coffinRotationRadians,
      blend,
    ),
    deathTick: lerp(first.deathTick, second.deathTick, blend),
    demonFrontExtremityOffset: {
      x: lerp(
        first.demonFrontExtremityOffset.x,
        second.demonFrontExtremityOffset.x,
        blend,
      ),
      y: lerp(
        first.demonFrontExtremityOffset.y,
        second.demonFrontExtremityOffset.y,
        blend,
      ),
    },
    demonFrontRotationRadians: lerp(
      first.demonFrontRotationRadians,
      second.demonFrontRotationRadians,
      blend,
    ),
    demonRearExtremityOffset: {
      x: lerp(
        first.demonRearExtremityOffset.x,
        second.demonRearExtremityOffset.x,
        blend,
      ),
      y: lerp(
        first.demonRearExtremityOffset.y,
        second.demonRearExtremityOffset.y,
        blend,
      ),
    },
    demonRearRotationRadians: lerp(
      first.demonRearRotationRadians,
      second.demonRearRotationRadians,
      blend,
    ),
    effects: interpolateEnemyEffects(first.effects, second.effects, blend),
    gaitPose: lerpCycle(first.gaitPose, second.gaitPose, blend, ENEMY_GAIT_POSE_COUNT),
    hitFlash: lerp(first.hitFlash, second.hitFlash, blend),
    impBodyRotationRadians: discrete.impBodyRotationRadians,
    impEffectAlpha: lerp(first.impEffectAlpha, second.impEffectAlpha, blend),
    impEffectFrame: older.enemyToken === 'IMP'
      ? interpolateImpEffectFrame(first.impEffectFrame, second.impEffectFrame, blend)
      : discrete.impEffectFrame,
    maggots: [],
    stridePhaseDeg: lerp(first.stridePhaseDeg, second.stridePhaseDeg, blend),
    verticalOffset: lerp(first.verticalOffset, second.verticalOffset, blend),
    zombieAngularOffsetDeg: lerp(
      first.zombieAngularOffsetDeg,
      second.zombieAngularOffsetDeg,
      blend,
    ),
    zombieBodyRotationRadians: lerp(
      first.zombieBodyRotationRadians,
      second.zombieBodyRotationRadians,
      blend,
    ),
    zombieFrontArmPose: lerp(first.zombieFrontArmPose, second.zombieFrontArmPose, blend),
    zombieFrontArmRotationRadians: lerp(
      first.zombieFrontArmRotationRadians,
      second.zombieFrontArmRotationRadians,
      blend,
    ),
    zombieHeadRotationRadians: lerp(
      first.zombieHeadRotationRadians,
      second.zombieHeadRotationRadians,
      blend,
    ),
    zombieRearArmPose: lerp(first.zombieRearArmPose, second.zombieRearArmPose, blend),
    zombieRearArmRotationRadians: lerp(
      first.zombieRearArmRotationRadians,
      second.zombieRearArmRotationRadians,
      blend,
    ),
  }
}

function interpolateImpEffectFrame(
  older: number,
  newer: number,
  blend: number,
): number {
  if (blend >= 1) return newer
  if (older < 0 || newer < 0) return older
  return lerpCycle(
    older,
    newer,
    blend,
    NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
  )
}

function interpolateEnemyEffects(
  older: BoneyardEnemySnapshot['animation']['effects'],
  newer: BoneyardEnemySnapshot['animation']['effects'],
  blend: number,
): BoneyardEnemySnapshot['animation']['effects'] {
  const newerById = new Map(newer.map((effect) => [effect.id, effect]))
  const effects = older.map((olderEffect) => {
    const newerEffect = newerById.get(olderEffect.id)
    if (!newerEffect || olderEffect.role !== newerEffect.role) {
      return copyEnemyEffect(olderEffect)
    }
    const discrete = blend < 1 ? olderEffect : newerEffect
    return {
      ...copyEnemyEffect(discrete),
      alpha: lerp(olderEffect.alpha, newerEffect.alpha, blend),
      offset: {
        x: lerp(olderEffect.offset.x, newerEffect.offset.x, blend),
        y: lerp(olderEffect.offset.y, newerEffect.offset.y, blend),
      },
      rotationRadians: lerp(
        olderEffect.rotationRadians,
        newerEffect.rotationRadians,
        blend,
      ),
      scale: lerp(olderEffect.scale, newerEffect.scale, blend),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(effects.map((effect) => effect.id))
    for (const effect of newer) {
      if (!knownIds.has(effect.id)) effects.push(copyEnemyEffect(effect))
    }
    return effects.filter((effect) => newerById.has(effect.id))
  }
  return effects
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

function requirePositiveFinite(value: number, name: string): void {
  requireFinite(value, name)
  if (value <= 0) throw new Error(`${name} must be positive`)
}
