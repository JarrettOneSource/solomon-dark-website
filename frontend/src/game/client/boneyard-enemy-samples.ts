import { NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT } from '../core-kernels/boneyard-imp-flight.ts'
import { NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES } from '../core-kernels/boneyard-mage-lightning.ts'
import type { BoneyardEnemyDeathEffectSnapshot, BoneyardEnemyProjectileEffectSnapshot, BoneyardEnemyProjectileSnapshot, BoneyardEnemySnapshot, BoneyardMaggotSnapshot, BoneyardWorldSnapshot } from '../protocol/game-state.ts'
import { lerpCycle } from './hub-presentation-timeline.ts'
import { FULL_CIRCLE, lerp, lerpVector } from './presentation-math.ts'
const ENEMY_GAIT_POSE_COUNT = 8

const GUIDED_MISSILE_VISUAL_PHASE_PERIOD = 720

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
      scaleY: lerp(olderEffect.scaleY, newerEffect.scaleY, blend),
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
      ...(olderEnemy.demonSkull === undefined || newerEnemy.demonSkull === undefined ? {} : { demonSkull: {
        ...discrete.demonSkull!,
        bodyHeadingDeg: lerpCycle(olderEnemy.demonSkull.bodyHeadingDeg, newerEnemy.demonSkull.bodyHeadingDeg, blend, 360),
        bodyOffset: lerpVector(olderEnemy.demonSkull.bodyOffset, newerEnemy.demonSkull.bodyOffset, blend),
        jitter: lerpVector(olderEnemy.demonSkull.jitter, newerEnemy.demonSkull.jitter, blend),
        eyeCharge: lerp(olderEnemy.demonSkull.eyeCharge, newerEnemy.demonSkull.eyeCharge, blend),
        chargeGlow: lerp(olderEnemy.demonSkull.chargeGlow, newerEnemy.demonSkull.chargeGlow, blend),
        flairGlow: lerp(olderEnemy.demonSkull.flairGlow, newerEnemy.demonSkull.flairGlow, blend),
        bodyPhaseDeg: lerpCycle(olderEnemy.demonSkull.bodyPhaseDeg, newerEnemy.demonSkull.bodyPhaseDeg, blend, 360),
        flickerPhaseDeg: lerpCycle(olderEnemy.demonSkull.flickerPhaseDeg, newerEnemy.demonSkull.flickerPhaseDeg, blend, 360),
        spin: lerp(olderEnemy.demonSkull.spin, newerEnemy.demonSkull.spin, blend),
      } }),
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

function copyEnemy(enemy: BoneyardEnemySnapshot): BoneyardEnemySnapshot {
  return {
    ...enemy,
    animation: {
      ...enemy.animation,
      spider: enemy.animation.spider === null ? null : { ...enemy.animation.spider },
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

export function copyLightRegistration<T extends { managerLane: 'actor' | 'transient'; registrationOrdinal: number } | null>(
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
    spider: first.spider !== null && second.spider !== null ? {
      bodyHeadingDeg: lerpCycle(first.spider.bodyHeadingDeg, second.spider.bodyHeadingDeg, blend, 360),
      outlineAlpha: lerp(first.spider.outlineAlpha, second.spider.outlineAlpha, blend),
      outlineTint: discrete.spider!.outlineTint,
    } : discrete.spider,
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
    shadowLateralOffset: lerpCycle(first.shadowLateralOffset, second.shadowLateralOffset, blend, 4),
    demonShadowOffset: {
      x: lerp(first.demonShadowOffset.x, second.demonShadowOffset.x, blend),
      y: lerp(first.demonShadowOffset.y, second.demonShadowOffset.y, blend),
    },
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

type EnemySamples = Pick<BoneyardWorldSnapshot,
  'deathEffects' | 'enemies' | 'enemyEvents' | 'enemyWorldFeedback'
  | 'enemyProjectileEffects' | 'enemyProjectiles' | 'mageLightningPulses' | 'maggots'
  | 'spiderSilks' | 'spiderRemains' | 'silkFragments' | 'webbedPlayers'
>

export function interpolateBoneyardEnemySamples(older: EnemySamples, newer: EnemySamples, blend: number, targetTick: number): EnemySamples {
  return {
    ...interpolateSpiderSamples(older, newer, blend),
    deathEffects: interpolateEnemyDeathEffects(
        older.deathEffects,
        newer.deathEffects,
        blend,
      ),
    enemies: interpolateEnemies(older.enemies, newer.enemies, blend),
    enemyEvents: (blend < 1 ? older.enemyEvents : newer.enemyEvents)
        .map(copyEnemyEvent),
    enemyWorldFeedback: {
        ...(blend < 1 ? older : newer).enemyWorldFeedback,
      },
    enemyProjectileEffects: interpolateEnemyProjectileEffects(
        older.enemyProjectileEffects,
        newer.enemyProjectileEffects,
        blend,
      ),
    enemyProjectiles: interpolateEnemyProjectiles(
        older.enemyProjectiles,
        newer.enemyProjectiles,
        blend,
      ),
    mageLightningPulses: mergeMageLightningPulses(
        older.mageLightningPulses,
        newer.mageLightningPulses,
        targetTick,
      ),
    maggots: interpolateMaggots(older.maggots, newer.maggots, blend),
  }
}

export function copyBoneyardEnemySamples(source: EnemySamples, tick: number): EnemySamples {
  return {
    spiderSilks: structuredClone(source.spiderSilks),
    silkFragments: structuredClone(source.silkFragments),
    spiderRemains: structuredClone(source.spiderRemains),
    webbedPlayers: structuredClone(source.webbedPlayers),
    deathEffects: source.deathEffects.map(copyEnemyDeathEffect),
    enemies: source.enemies.map(copyEnemy),
    enemyEvents: source.enemyEvents.map(copyEnemyEvent),
    enemyWorldFeedback: { ...source.enemyWorldFeedback },
    enemyProjectileEffects: source.enemyProjectileEffects
        .map(copyEnemyProjectileEffect),
    enemyProjectiles: source.enemyProjectiles.map(copyEnemyProjectile),
    mageLightningPulses: mergeMageLightningPulses(
        source.mageLightningPulses,
        [],
        tick,
      ),
    maggots: source.maggots.map(copyMaggot),
  }
}

function interpolateSpiderSamples(older: EnemySamples, newer: EnemySamples, blend: number) {
  return {
    webbedPlayers: structuredClone((blend < 1 ? older : newer).webbedPlayers),
    spiderSilks: interpolateSpiderMembers(older.spiderSilks, newer.spiderSilks, blend, (first, second) => ({
      ...first,
      state: {
        ...first.state,
        ageTicks: lerp(first.state.ageTicks, second.state.ageTicks, blend),
        phase: lerp(first.state.phase, second.state.phase, blend),
        height: lerp(first.state.height, second.state.height, blend),
        alpha: lerp(first.state.alpha, second.state.alpha, blend),
        waveScale: lerp(first.state.waveScale, second.state.waveScale, blend),
        position: {
          x: lerp(first.state.position.x, second.state.position.x, blend),
          y: lerp(first.state.position.y, second.state.position.y, blend),
        },
        drift: {
          x: lerp(first.state.drift.x, second.state.drift.x, blend),
          y: lerp(first.state.drift.y, second.state.drift.y, blend),
        },
      },
    })),
    silkFragments: interpolateSpiderMembers(older.silkFragments, newer.silkFragments, blend, (first, second) => ({
      ...first, state: { ...first.state,
        start: lerpVector(first.state.start, second.state.start, blend),
        middle: lerpVector(first.state.middle, second.state.middle, blend),
        end: lerpVector(first.state.end, second.state.end, blend),
        opacity: lerp(first.state.opacity, second.state.opacity, blend),
      },
    })),
    spiderRemains: interpolateSpiderMembers(older.spiderRemains, newer.spiderRemains, blend, (first, second) => ({
      ...first,
      state: {
        ...first.state,
        life: lerp(first.state.life, second.state.life, blend),
        position: {
          x: lerp(first.state.position.x, second.state.position.x, blend),
          y: lerp(first.state.position.y, second.state.position.y, blend),
        },
        decal: first.state.decal === null || second.state.decal === null ? first.state.decal : {
          ...first.state.decal,
          scale: lerp(first.state.decal.scale, second.state.decal.scale, blend),
          alpha: lerp(first.state.decal.alpha, second.state.decal.alpha, blend),
        },
      },
    })),
  }
}

function interpolateSpiderMembers<T extends { readonly id: number }>(
  older: readonly T[], newer: readonly T[], blend: number, mix: (first: T, second: T) => T,
): readonly T[] {
  if (blend >= 1) return structuredClone(newer)
  const byId = new Map(newer.map((member) => [member.id, member]))
  return older.map((member) => {
    const second = byId.get(member.id)
    const first = structuredClone(member)
    return second === undefined ? first : mix(first, second)
  })
}
