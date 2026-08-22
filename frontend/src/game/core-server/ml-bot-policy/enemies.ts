import type { Vector2 } from '../../core-kernels/vector.ts'
import type {
  BoneyardEnemyActor,
  BoneyardMaggotActor,
  BoneyardEnemyStore,
} from '../boneyard-enemy-store.ts'
import { ML_BOT_POLICY_ENEMY_TOKEN_SPECIES } from './closed-unions.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export type MlBotPolicyEnemySource = BoneyardEnemyActor | BoneyardMaggotActor
export type MlBotPolicyEnemySpecies =
  | 'archer'
  | 'coffin'
  | 'demon'
  | 'imp'
  | 'mage'
  | 'maggot'
  | 'skeleton'
  | 'wraith'
  | 'zombie'

interface PreviousEnemyPosition {
  readonly position: Readonly<Vector2>
  readonly tick: number
}

export interface MlBotPolicyEnemyMemory {
  readonly previousPositions: ReadonlyMap<number, PreviousEnemyPosition>
  readonly targetId: number | null
}

export interface MlBotPolicyEnemyRow {
  readonly currentHealth: number
  readonly headingDeg: number
  readonly id: number
  readonly maximumHealth: number
  readonly position: Readonly<Vector2>
  readonly radius: number
  readonly source: MlBotPolicyEnemySource
  readonly species: MlBotPolicyEnemySpecies
  readonly targetPlayerId: string | null
  readonly velocity: Readonly<Vector2>
}

export interface MlBotPolicyEnemyObservationOptions {
  readonly memory: MlBotPolicyEnemyMemory
  readonly ownMinionTargetIds: ReadonlySet<number>
  readonly primaryRange: number
  readonly selfPosition: Readonly<Vector2>
  readonly tick: number
}

export interface MlBotPolicyEnemyObservation {
  readonly blockD: Float32Array
  readonly blockE: Float32Array
  readonly blockL: Float32Array
  readonly next: Readonly<{ memory: MlBotPolicyEnemyMemory }>
  readonly rows: readonly MlBotPolicyEnemyRow[]
}

export function createMlBotPolicyEnemyMemory(): MlBotPolicyEnemyMemory {
  return { previousPositions: new Map(), targetId: null }
}

export function observeMlBotPolicyEnemies(
  world: Readonly<{ enemies: BoneyardEnemyStore }>,
  options: MlBotPolicyEnemyObservationOptions,
): MlBotPolicyEnemyObservation {
  const previousPositions = new Map<number, PreviousEnemyPosition>()
  const rows = [
    ...world.enemies.actors
      .filter(({ lifeState }) => lifeState === 'alive')
      .map((actor) => enemyRow(actor, options, previousPositions)),
    ...world.enemies.maggots
      .filter(({ lifeState }) => lifeState === 'alive')
      .map((actor) => maggotRow(actor, options, previousPositions)),
  ].sort((left, right) => (
    distanceSquared(left.position, options.selfPosition)
    - distanceSquared(right.position, options.selfPosition)
    || left.id - right.id
  ))
  const targetId = rows.some(({ id }) => id === options.memory.targetId)
    ? options.memory.targetId
    : null
  const blockD = new Float32Array(8 * 11)
  for (let slot = 0; slot < Math.min(8, rows.length); slot += 1) {
    const row = rows[slot]!
    const start = slot * 11
    const dx = row.position.x - options.selfPosition.x
    const dy = row.position.y - options.selfPosition.y
    const distance = Math.hypot(dx, dy)
    blockD[start] = 1
    blockD[start + 1] = scaledSigned(dx, ML_BOT_POLICY_SCALES.range)
    blockD[start + 2] = scaledSigned(dy, ML_BOT_POLICY_SCALES.range)
    blockD[start + 3] = scaledUnsigned(distance, ML_BOT_POLICY_SCALES.range)
    blockD[start + 4] = ratio(row.currentHealth, row.maximumHealth)
    blockD[start + 5] = scaledUnsigned(row.radius, ML_BOT_POLICY_SCALES.radius)
    blockD[start + 6] = scaledSigned(row.velocity.x, ML_BOT_POLICY_SCALES.velocity)
    blockD[start + 7] = scaledSigned(row.velocity.y, ML_BOT_POLICY_SCALES.velocity)
    blockD[start + 8] = Number(Math.max(0, distance - row.radius) <= options.primaryRange)
    blockD[start + 9] = Number(row.id === targetId)
    blockD[start + 10] = Number(options.ownMinionTargetIds.has(row.id))
  }

  const target = targetId === null ? null : rows.find(({ id }) => id === targetId) ?? null
  const blockE = new Float32Array(9)
  const blockL = new Float32Array(4)
  if (target) {
    const dx = target.position.x - options.selfPosition.x
    const dy = target.position.y - options.selfPosition.y
    const distance = Math.hypot(dx, dy)
    blockE[0] = 1
    blockE[1] = scaledSigned(dx, ML_BOT_POLICY_SCALES.range)
    blockE[2] = scaledSigned(dy, ML_BOT_POLICY_SCALES.range)
    blockE[3] = scaledUnsigned(distance, ML_BOT_POLICY_SCALES.range)
    blockE[4] = scaledUnsigned(Math.max(0, distance - target.radius), ML_BOT_POLICY_SCALES.range)
    blockE[5] = ratio(target.currentHealth, target.maximumHealth)
    blockE[6] = scaledUnsigned(target.radius, ML_BOT_POLICY_SCALES.radius)
    blockE[7] = Number(Math.max(0, distance - target.radius) <= options.primaryRange)
    blockE[8] = scaledUnsigned(options.primaryRange, ML_BOT_POLICY_SCALES.range)
    blockL[0] = scaledSigned(target.velocity.x, ML_BOT_POLICY_SCALES.velocity)
    blockL[1] = scaledSigned(target.velocity.y, ML_BOT_POLICY_SCALES.velocity)
    const facing = headingVector(target.headingDeg)
    blockL[2] = facing.x
    blockL[3] = facing.y
  }
  return {
    blockD,
    blockE,
    blockL,
    next: { memory: { previousPositions, targetId } },
    rows,
  }
}

function enemyRow(
  actor: BoneyardEnemyActor,
  options: MlBotPolicyEnemyObservationOptions,
  nextPositions: Map<number, PreviousEnemyPosition>,
): MlBotPolicyEnemyRow {
  return commonRow({
    actor,
    currentHealth: actor.currentHealth,
    headingDeg: actor.headingDeg,
    maximumHealth: actor.config.maximumHealth,
    options,
    radius: actor.config.collisionRadius,
    species: ML_BOT_POLICY_ENEMY_TOKEN_SPECIES[actor.config.enemyToken],
    targetPlayerId: actor.targetPlayerId,
  }, nextPositions)
}

function maggotRow(
  actor: BoneyardMaggotActor,
  options: MlBotPolicyEnemyObservationOptions,
  nextPositions: Map<number, PreviousEnemyPosition>,
): MlBotPolicyEnemyRow {
  return commonRow({
    actor,
    currentHealth: actor.currentHealth,
    headingDeg: actor.headingDeg,
    maximumHealth: actor.maximumHealth,
    options,
    radius: actor.collisionRadius,
    species: 'maggot',
    targetPlayerId: actor.targetPlayerId,
  }, nextPositions)
}

function commonRow(input: Readonly<{
  actor: MlBotPolicyEnemySource
  currentHealth: number
  headingDeg: number
  maximumHealth: number
  options: MlBotPolicyEnemyObservationOptions
  radius: number
  species: MlBotPolicyEnemySpecies
  targetPlayerId: string | null
}>, nextPositions: Map<number, PreviousEnemyPosition>): MlBotPolicyEnemyRow {
  const previous = input.options.memory.previousPositions.get(input.actor.id)
  const elapsedTicks = previous ? Math.max(1, input.options.tick - previous.tick) : 0
  const velocity = elapsedTicks === 0
    ? { x: 0, y: 0 }
    : {
        x: (input.actor.position.x - previous!.position.x)
          * ML_BOT_POLICY_SCALES.tickRate / elapsedTicks,
        y: (input.actor.position.y - previous!.position.y)
          * ML_BOT_POLICY_SCALES.tickRate / elapsedTicks,
      }
  nextPositions.set(input.actor.id, {
    position: { ...input.actor.position },
    tick: input.options.tick,
  })
  return {
    currentHealth: input.currentHealth,
    headingDeg: input.headingDeg,
    id: input.actor.id,
    maximumHealth: input.maximumHealth,
    position: input.actor.position,
    radius: input.radius,
    source: input.actor,
    species: input.species,
    targetPlayerId: input.targetPlayerId,
    velocity,
  }
}

function headingVector(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function distanceSquared(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}

function scaledSigned(value: number, scale: number): number {
  return Math.max(-1, Math.min(1, value / scale))
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}
