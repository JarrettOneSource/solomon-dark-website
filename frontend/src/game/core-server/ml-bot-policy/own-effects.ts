import type { PlayerSkillQuickbar } from '../../core-kernels/player-progression.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import type { NativeSecondarySimulationState } from '../../core-kernels/native-secondary-abilities.ts'
import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../../core-kernels/primary-spells.ts'
import { ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES } from './closed-unions.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyOwnEffectState {
  readonly primarySpells: PrimarySpellSimulationState
  readonly secondaryAbilities: NativeSecondarySimulationState
}

export interface MlBotPolicyOwnEffectOptions {
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly quickbar: PlayerSkillQuickbar
  readonly worldKey: string
}

export interface MlBotPolicyOwnEffectObservation {
  readonly blockR: Float32Array
  readonly primaryEffectActive: boolean
  readonly secondaryEffectActive: readonly boolean[]
}

interface OwnEffectRow {
  readonly damage: number
  readonly family: 'area' | 'channel' | 'projectile'
  readonly hasTarget: boolean
  readonly held: boolean
  readonly id: number
  readonly position: Readonly<Vector2>
  readonly radius: number
  readonly remainingSeconds: number
  readonly sourcePrimary: boolean
  readonly sourceSlot: number | null
  readonly velocity: Readonly<Vector2>
}

const PRIMARY_EFFECT_KINDS = new Set<string>([
  'air',
  'air-hurricane',
  'air-prismatic',
  'air-storm',
  'air-storm-strike',
  'ether-blast',
  'fire-ember',
  'fire-explosion',
  'fire-patch',
  'water',
  'water-freeze-wave',
  'water-hail',
  'weld-channel',
  'weld-hail-knockback',
  'weld-meteor',
  'weld-persistent',
  'weld-steam',
])

const PRIMARY_CHANNEL_KINDS = new Set<string>(['air', 'water', 'weld-channel'])
const SECONDARY_PROJECTILE_KINDS = new Set<string>([
  'comet', 'ether-bolt', 'moving-fire', 'plane-orb-shot',
])

export function observeMlBotPolicyOwnEffects(
  state: MlBotPolicyOwnEffectState,
  options: MlBotPolicyOwnEffectOptions,
): MlBotPolicyOwnEffectObservation {
  const rows: OwnEffectRow[] = []
  for (const projectile of state.primarySpells.projectiles) {
    if (projectile.ownerId !== options.playerId || projectile.worldKey !== options.worldKey) continue
    rows.push(primaryProjectileRow(projectile))
  }
  for (const transient of state.primarySpells.transients) {
    if (
      transient.ownerId !== options.playerId
      || transient.worldKey !== options.worldKey
      || !PRIMARY_EFFECT_KINDS.has(transient.kind)
    ) continue
    rows.push(primaryTransientRow(transient))
  }
  for (const actor of state.secondaryAbilities.actors) {
    if (
      actor.ownerId !== options.playerId
      || actor.worldKey !== options.worldKey
      || ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES[actor.kind] !== 'effect'
    ) continue
    const sourceSlot = actor.skillId === null
      ? null
      : (options.quickbar as readonly (number | null)[]).indexOf(actor.skillId)
    rows.push({
      damage: actor.damage,
      family: SECONDARY_PROJECTILE_KINDS.has(actor.kind) ? 'projectile' : 'area',
      hasTarget: actor.targetId !== null,
      held: false,
      id: actor.id,
      position: actor.position,
      radius: Math.max(0, actor.radius),
      remainingSeconds: actor.lifetimeTicks > 0
        ? Math.max(0, actor.lifetimeTicks - actor.ageTicks) / ML_BOT_POLICY_SCALES.tickRate
        : ML_BOT_POLICY_SCALES.effectLifetimeSeconds,
      sourcePrimary: false,
      sourceSlot: sourceSlot === null || sourceSlot < 0 ? null : sourceSlot,
      velocity: actor.velocity,
    })
  }
  rows.sort((left, right) => (
    edgeDistance(left, options.position) - edgeDistance(right, options.position)
    || Number(right.sourcePrimary) - Number(left.sourcePrimary)
    || left.id - right.id
  ))

  const blockR = new Float32Array(6 * 23 + 3)
  for (let slot = 0; slot < Math.min(6, rows.length); slot += 1) {
    const row = rows[slot]!
    const start = slot * 23
    const relative = {
      x: row.position.x - options.position.x,
      y: row.position.y - options.position.y,
    }
    const direction = normalized(relative.x, relative.y)
    blockR[start] = 1
    blockR[start + 1] = Number(row.sourcePrimary)
    if (row.sourceSlot !== null) blockR[start + 2 + row.sourceSlot] = 1
    blockR[start + 10] = Number(row.family === 'projectile')
    blockR[start + 11] = Number(row.family === 'area')
    blockR[start + 12] = Number(row.family === 'channel')
    blockR[start + 13] = direction.x
    blockR[start + 14] = direction.y
    blockR[start + 15] = scaledUnsigned(
      Math.max(0, Math.hypot(relative.x, relative.y) - row.radius),
      ML_BOT_POLICY_SCALES.range,
    )
    blockR[start + 16] = scaledSigned(row.velocity.x, ML_BOT_POLICY_SCALES.velocity)
    blockR[start + 17] = scaledSigned(row.velocity.y, ML_BOT_POLICY_SCALES.velocity)
    blockR[start + 18] = scaledUnsigned(row.radius, ML_BOT_POLICY_SCALES.radius)
    blockR[start + 19] = scaledUnsigned(
      row.remainingSeconds,
      ML_BOT_POLICY_SCALES.effectLifetimeSeconds,
    )
    blockR[start + 20] = scaledUnsigned(row.damage, ML_BOT_POLICY_SCALES.skillDamage)
    blockR[start + 21] = Number(row.held)
    blockR[start + 22] = Number(row.hasTarget)
  }
  blockR[6 * 23] = Math.min(rows.length, ML_BOT_POLICY_SCALES.ownEffectCount)
    / ML_BOT_POLICY_SCALES.ownEffectCount
  blockR[6 * 23 + 1] = Math.min(
    rows.filter(({ family }) => family === 'projectile').length,
    ML_BOT_POLICY_SCALES.ownEffectCount,
  ) / ML_BOT_POLICY_SCALES.ownEffectCount
  blockR[6 * 23 + 2] = Math.min(
    rows.filter(({ family }) => family === 'area').length,
    ML_BOT_POLICY_SCALES.ownEffectCount,
  ) / ML_BOT_POLICY_SCALES.ownEffectCount

  return {
    blockR,
    primaryEffectActive: rows.some(({ sourcePrimary }) => sourcePrimary),
    secondaryEffectActive: Object.freeze(Array.from({ length: 8 }, (_, slot) => (
      rows.some(({ sourceSlot }) => sourceSlot === slot)
    ))),
  }
}

function primaryProjectileRow(projectile: PrimarySpellProjectileState): OwnEffectRow {
  const record = projectile as unknown as Record<string, unknown>
  return {
    damage: numberField(record, 'damage'),
    family: 'projectile',
    hasTarget: typeof record.targetId === 'string',
    held: projectile.phase === 'held',
    id: projectile.id,
    position: projectile.position,
    radius: numberField(record, 'contactRadius', 'explodeRadius', 'radius'),
    remainingSeconds: ML_BOT_POLICY_SCALES.effectLifetimeSeconds,
    sourcePrimary: true,
    sourceSlot: null,
    velocity: projectile.velocity,
  }
}

function primaryTransientRow(transient: PrimarySpellTransientState): OwnEffectRow {
  const record = transient as unknown as Record<string, unknown>
  const position = vectorField(record, 'position', 'midpoint', 'origin')
  const velocity = vectorField(record, 'velocity', 'horizontalVelocity')
  const ageTicks = numberField(record, 'ageTicks')
  const remainingTicks = firstFinite(
    finiteField(record, 'activeTicksRemaining'),
    finiteField(record, 'lifetimeTicks'),
    finiteField(record, 'durationTicks') === null
      ? null
      : Math.max(0, finiteField(record, 'durationTicks')! - ageTicks),
  )
  return {
    damage: numberField(record, 'damage', 'damageMaximum'),
    family: PRIMARY_CHANNEL_KINDS.has(transient.kind) ? 'channel' : 'area',
    hasTarget: typeof record.targetId === 'string' || typeof record.targetId === 'number',
    held: record.phase === 'held',
    id: numberField(record, 'id'),
    position,
    radius: numberField(record, 'radius', 'collisionRadius', 'explodeRadius'),
    remainingSeconds: remainingTicks === null
      ? ML_BOT_POLICY_SCALES.effectLifetimeSeconds
      : Math.max(0, remainingTicks) / ML_BOT_POLICY_SCALES.tickRate,
    sourcePrimary: true,
    sourceSlot: null,
    velocity,
  }
}

function edgeDistance(row: OwnEffectRow, observer: Readonly<Vector2>): number {
  return Math.max(0, Math.hypot(
    row.position.x - observer.x,
    row.position.y - observer.y,
  ) - row.radius)
}

function vectorField(record: Record<string, unknown>, ...keys: readonly string[]): Vector2 {
  for (const key of keys) {
    const value = record[key]
    if (
      value !== null
      && typeof value === 'object'
      && Number.isFinite((value as Vector2).x)
      && Number.isFinite((value as Vector2).y)
    ) return { x: (value as Vector2).x, y: (value as Vector2).y }
  }
  return { x: 0, y: 0 }
}

function numberField(record: Record<string, unknown>, ...keys: readonly string[]): number {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return 0
}

function finiteField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function firstFinite(...values: readonly (number | null)[]): number | null {
  return values.find((value): value is number => value !== null) ?? null
}

function normalized(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y)
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
}

function scaledSigned(value: number, scale: number): number {
  return Math.max(-1, Math.min(1, value / scale))
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}
