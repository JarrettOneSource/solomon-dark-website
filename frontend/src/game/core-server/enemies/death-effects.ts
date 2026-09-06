import type { BoneyardWaveEnemyToken } from '../../core-kernels/boneyard-wave-schema.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { stepBornBoneyardBouncer } from '../boneyard-transient-effects.ts'
import type { BoneyardEnemyActor, BoneyardEnemyActorId, BoneyardEnemyDeathEffect, BoneyardEnemyDeathEffectKind, WorkingStep } from './model.ts'
import { NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS } from './programs.ts'
import { drawUnit, radialVector } from './random.ts'
export interface DeathEffectOwner {
  readonly id: BoneyardEnemyActorId
  readonly position: Readonly<BoneyardPoint>
}

export function spawnRadialBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number | (() => number),
  role: string,
  speed = 1,
  atlas: BoneyardEnemyDeathEffect['atlas'] = 'BadGuys',
): void {
  spawnBouncer(work, actor, tick, entry, role, () => ({
    atlas,
    velocity: radialVector(drawUnit(work) * 360, speed),
  }))
}

type BouncerOptions = {
  bounceVelocityMultiplier?: number
  presentationOwner?: BoneyardEnemyDeathEffect['presentationOwner']
  atlas?: BoneyardEnemyDeathEffect['atlas']
  bounceRetention?: number
  bounceVelocityScale?: number
  heightScale?: number
  kind?: 'bouncer' | 'smoky-bouncer' | 'black-smoky-bouncer'
  opacityTimer?: number
  position?: Readonly<BoneyardPoint>
  height?: number
  scale?: number
  scaleY?: number
  tint?: number
  velocity?: Readonly<BoneyardPoint>
}

export function spawnBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number | (() => number),
  role: string,
  options: BouncerOptions | (() => BouncerOptions) = {},
): void {
  const constructorVerticalVelocity = -(drawUnit(work) * 3 + 2)
  const constructorHeight = -drawUnit(work) * 20
  const rotationDeg = drawUnit(work) * 360
  const angularVelocityDeg = drawUnit(work) * 10 + 1
  const resolvedEntry = typeof entry === 'function' ? entry() : entry
  const resolvedOptions = typeof options === 'function' ? options() : options
  const verticalVelocity = constructorVerticalVelocity
    * (resolvedOptions.bounceVelocityScale ?? 1)
  const opacityTimer = resolvedOptions.opacityTimer ?? 10
  const effect: BoneyardEnemyDeathEffect = Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: 0.015,
    angularVelocityDeg,
    atlas: resolvedOptions.atlas ?? 'BadGuys',
    blendMode: 'normal',
    bounceRetention: resolvedOptions.bounceRetention ?? 0.65,
    bounceVelocity: verticalVelocity * (resolvedOptions.bounceVelocityMultiplier ?? 1),
    entry: resolvedEntry,
    firstEntry: resolvedEntry,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: resolvedOptions.height ?? constructorHeight * (resolvedOptions.heightScale ?? 1),
    id: work.nextDeathEffectId,
    kind: resolvedOptions.kind ?? 'bouncer',
    lastStepTick: tick,
    lifetimeTicks: Math.ceil(opacityTimer / .015 * 1.5) + 1,
    opacityTimer,
    ownerActorId: actor.id,
    painterRegistration: (resolvedOptions.presentationOwner ?? 'world-sorted') === 'world-sorted' ? work.registerWorldPainter('transient') : null,
    presentationOwner: resolvedOptions.presentationOwner ?? 'world-sorted',
    position: Object.freeze({ ...(resolvedOptions.position ?? actor.position) }),
    role,
    rotationDeg,
    scale: resolvedOptions.scale ?? 1,
    scaleY: resolvedOptions.scaleY ?? resolvedOptions.scale ?? 1,
    scaleMultiplier: 1,
    shadow: true,
    spawnTick: tick,
    tint: resolvedOptions.tint ?? 0xffffff,
    verticalVelocity,
    velocity: Object.freeze({ ...(resolvedOptions.velocity ?? { x: 0, y: 0 }) }),
    velocityDamping: 1,
  })
  work.nextDeathEffectId += 1
  const stepped = stepBornBoneyardBouncer(
    effect,
    tick,
    () => drawUnit(work),
    work.nextDeathEffectId,
    work.registerWorldPainter,
  )
  work.nextDeathEffectId = stepped.nextDeathEffectId
  work.deathEffects.push(...stepped.effects)
}

export function spawnUnbind(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const clock = unbindClock(actor.config.enemyToken)
  const alpha = actor.lethalMagicDamage ? 1.25 : clock.alpha
  const alphaLossPerTick = clock.alphaLossPerTick
  const rotationDeg = drawUnit(work) * 360
  const angularOffsetDeg = drawUnit(work) * 2.5
  const clockwise = drawUnit(work) >= 0.5
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha,
    alphaLossPerTick,
    angularVelocityDeg: clockwise
      ? 5 + angularOffsetDeg
      : -5 + angularOffsetDeg,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 86,
    kind: 'unbind',
    lifetimeTicks: Math.ceil(alpha / alphaLossPerTick),
    position: { x: actor.position.x + (actor.config.enemyToken === 'HEARTMONGER' || actor.config.enemyToken === 'DIREFACULTY' ? 0 : 1), y: actor.position.y - 15 },
    presentationOwner: 'late-world-overlay',
    role: 'death-unbind-star',
    rotationDeg,
    scale: actor.config.enemyToken === 'HEARTMONGER' ? 3 : actor.config.enemyToken === 'DIREFACULTY' ? 2 : 1,
  })
}

function unbindClock(
  enemyToken: BoneyardWaveEnemyToken,
): Readonly<{ alpha: number; alphaLossPerTick: number }> {
  switch (enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      return { alpha: 0.75, alphaLossPerTick: 0.0225 }
    case 'IMP':
    case 'WRAITH':
      return { alpha: 1, alphaLossPerTick: 0.025 }
    case 'ZOMBIE':
      return { alpha: 0.75, alphaLossPerTick: 0.05 }
    case 'COFFIN':
      return { alpha: 0.75, alphaLossPerTick: 0.045 }
    case 'HEARTMONGER':
    case 'DIREFACULTY':
      return { alpha: .75, alphaLossPerTick: Math.fround(.0225) }
    case 'DEMONSKULL':
    case 'DEMON':
    case 'SPIDER':
    case 'COCOON':
    case 'PORTAL':
      throw new Error(`${enemyToken} death does not create Anim_Unbind`)
  }
}

export function spawnSpriteArray(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  role: string,
  firstEntry: number,
  frameCount: number,
  frameTicks: number,
  options: Readonly<{
    alphaLossPerTick?: number
    angularVelocityDeg?: number
    atlas?: BoneyardEnemyDeathEffect['atlas']
    blendMode?: BoneyardEnemyDeathEffect['blendMode']
    frameVelocity?: number
    frameVelocityDamping?: number
    kind?: 'fire-array' | 'sprite-array'
    lifetimeTicks?: number
    position?: Readonly<BoneyardPoint>
    presentationOwner?: BoneyardEnemyDeathEffect['presentationOwner']
    rotationDeg?: number
    scale?: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
  }> = {},
): void {
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: options.alphaLossPerTick ?? 0,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas ?? 'BadGuys',
    blendMode: options.blendMode ?? 'add',
    entry: firstEntry,
    firstEntry,
    frameCount,
    frameVelocity: options.frameVelocity ?? 1 / frameTicks,
    frameVelocityDamping: options.frameVelocityDamping ?? 1,
    frameTicks,
    kind: options.kind ?? 'sprite-array',
    lifetimeTicks: options.lifetimeTicks
      ?? (options.kind === 'fire-array'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombFireTicks
        : 1_000),
    position: options.position,
    presentationOwner: options.presentationOwner,
    role,
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale ?? 1,
    spawnDelayTicks: options.spawnDelayTicks,
    tint: options.tint,
    velocity: options.velocity,
  })
}

export function spawnSimpleDeathEffect(
  work: Pick<WorkingStep, 'deathEffects' | 'nextDeathEffectId' | 'registerWorldPainter'>,
  actor: DeathEffectOwner,
  tick: number,
  options: {
    alpha: number
    painterSortBias?: number
    scrapOscillation?: BoneyardEnemyDeathEffect['scrapOscillation']
    alphaMultiplier?: number
    alphaLossPerTick: number
    angularVelocityDeg?: number
    atlas: BoneyardEnemyDeathEffect['atlas']
    blendMode: BoneyardEnemyDeathEffect['blendMode']
    entry: number
    firstEntry?: number
    frameCount?: number
    framePhase?: number
    frameVelocity?: number
    frameVelocityDamping?: number
    frameTicks?: number
    kind: Exclude<BoneyardEnemyDeathEffectKind, 'bouncer' | 'smoky-bouncer' | 'black-smoky-bouncer'>
    lifetimeTicks: number
    opacityTimer?: number
    position?: Readonly<BoneyardPoint>
    presentationOwner?: BoneyardEnemyDeathEffect['presentationOwner']
    role: string
    rotationDeg?: number
    scale: number
    scaleY?: number
    scaleMultiplier?: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
    velocityDamping?: number
  },
): void {
  const presentationOwner = options.presentationOwner ?? 'world-sorted'
  work.deathEffects.push(Object.freeze({
    ageTicks: 0,
    ...(options.painterSortBias === undefined ? {} : { painterSortBias: options.painterSortBias }),
    ...(options.scrapOscillation === undefined ? {} : { scrapOscillation: options.scrapOscillation }),
    alpha: options.alpha,
    alphaMultiplier: options.alphaMultiplier ?? 1,
    alphaLossPerTick: options.alphaLossPerTick,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas,
    blendMode: options.blendMode,
    bounceRetention: 0,
    bounceVelocity: 0,
    entry: options.entry,
    firstEntry: options.firstEntry ?? options.entry,
    frameCount: options.frameCount ?? 1,
    framePhase: options.framePhase ?? 0,
    frameVelocity: options.frameVelocity ?? 0,
    frameVelocityDamping: options.frameVelocityDamping ?? 1,
    frameTicks: options.frameTicks ?? 1,
    height: 0,
    id: work.nextDeathEffectId,
    kind: options.kind,
    lastStepTick: tick,
    lifetimeTicks: options.lifetimeTicks,
    opacityTimer: options.opacityTimer ?? options.alpha,
    ownerActorId: actor.id,
    painterRegistration: presentationOwner === 'world-sorted'
      ? work.registerWorldPainter('transient')
      : null,
    presentationOwner,
    position: Object.freeze({ ...(options.position ?? actor.position) }),
    role: options.role,
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale,
    scaleY: options.scaleY ?? options.scale,
    scaleMultiplier: options.scaleMultiplier ?? 1,
    shadow: false,
    spawnTick: tick + (options.spawnDelayTicks ?? 0),
    tint: options.tint ?? 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
    velocityDamping: options.velocityDamping ?? 1,
  }))
  work.nextDeathEffectId += 1
}
