import type { BoneyardSilkActor } from '../enemies/model.ts'
import {
  type PrimarySpellTarget,
  nativePrimaryRootTargets,
} from '../../core-kernels/primary-spell-targeting.ts'
import type {
  PrimarySpellAirTransientState,
  PrimarySpellChannelEmission,
  PrimarySpellSimulationState,
} from '../../core-kernels/primary-spells.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyProjectile,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
  boneyardEnemyActorFlags,
  boneyardEnemyCollisionRadius,
} from '../enemies/model.ts'

export type BoneyardSpellTarget = BoneyardEnemyActor | BoneyardMaggotActor

export interface PrimaryTargetRow {
  readonly actor: BoneyardSpellTarget
  readonly disintegratePhase: number
  readonly kind: 'enemy'
  readonly target: PrimarySpellTarget
}

interface PrimaryProjectileTargetRow {
  readonly kind: 'arrow'
  readonly projectile: BoneyardEnemyProjectile
  readonly target: PrimarySpellTarget
}

interface PrimarySilkTargetRow {
  readonly kind: 'silk'
  readonly projectile: BoneyardSilkActor
  readonly target: PrimarySpellTarget
}

interface PrimarySceneryTargetRow {
  readonly actor: null
  readonly kind: 'scenery'
  readonly target: PrimarySpellTarget
}

export type PrimaryForceTargetRow = PrimaryProjectileTargetRow | PrimarySilkTargetRow

type PrimaryWaterTargetRow = PrimaryTargetRow | PrimaryForceTargetRow

type PrimaryBlizzardTargetRow = PrimaryWaterTargetRow | PrimarySceneryTargetRow

const NATIVE_LIGHTNING_CHAIN_RADIUS = 200

export function nearestUnusedAirChainTarget(
  targets: readonly PrimarySpellTarget[],
  origin: Readonly<Vector2>,
  contactedIds: ReadonlySet<string>,
  radius = NATIVE_LIGHTNING_CHAIN_RADIUS,
): PrimarySpellTarget | null {
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = Number.POSITIVE_INFINITY
  for (const target of nativePrimaryRootTargets(
    { ...origin },
    radius,
    0x2,
    targets,
  )) {
    if (contactedIds.has(target.id)) continue
    const distanceSquared = squaredDistance(origin, target.position)
    if (distanceSquared < selectedDistanceSquared) {
      selected = target
      selectedDistanceSquared = distanceSquared
    }
  }
  return selected
}

export function parseEnemyTargetId(targetId: string): number | null {
  if (!targetId.startsWith('enemy:')) return null
  const value = Number(targetId.slice('enemy:'.length))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function nativePrimaryRootTargetRows(
  store: BoneyardEnemyStore,
  origin: Readonly<Vector2>,
  reach: number,
  actorMask: number,
): readonly PrimaryTargetRow[] {
  const rows = primaryTargetRows(store)
  const targets = new Set(nativePrimaryRootTargets(
    { ...origin },
    reach,
    actorMask,
    rows.map(({ target }) => target),
  ).map(({ id }) => id))
  return rows.filter(({ target }) => targets.has(target.id))
}

export function boneyardSpellTargetById(
  store: BoneyardEnemyStore,
  actorId: number,
): BoneyardSpellTarget | null {
  return store.actors.find(({ id }) => id === actorId)
    ?? store.maggots.find(({ id }) => id === actorId)
    ?? null
}

export function targetBodyRadius(target: BoneyardSpellTarget): number {
  return 'config' in target ? boneyardEnemyCollisionRadius(target) : target.collisionRadius
}

export function normalizedDifference(
  origin: Readonly<Vector2>,
  target: Readonly<Vector2>,
): Vector2 {
  const x = target.x - origin.x
  const y = target.y - origin.y
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 0, y: -1 } : { x: x / length, y: y / length }
}

export function selectedAirTargets(
  rows: readonly PrimaryTargetRow[],
  spells: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
): readonly PrimarySpellTarget[] {
  const transient = spells.transients.find((effect): effect is PrimarySpellAirTransientState => (
    effect.kind === 'air'
    && effect.id === emission.id
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
  ))
  if (!transient?.targetId) return []
  const row = rows.find(({ target }) => target.id === transient.targetId)
  return row?.target.active && !row.target.pendingRemove ? [row.target] : []
}

export function selectedWeldTarget(
  rows: readonly PrimaryTargetRow[],
  spells: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
): PrimarySpellTarget | null {
  const transient = spells.transients.find((effect) => (
    effect.kind === 'weld-channel'
    && effect.id === emission.id
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
    && effect.buildId === 1003
  ))
  if (transient?.kind !== 'weld-channel' || transient.targetId === null) return null
  const row = rows.find(({ target }) => target.id === transient.targetId)
  return row?.target.active && !row.target.pendingRemove ? row.target : null
}

export function primaryTargetRows(
  store: Pick<BoneyardEnemyStore, 'actors' | 'maggots'>,
): readonly PrimaryTargetRow[] {
  return [...store.actors, ...store.maggots].map((actor, disintegratePhase) => ({
    actor,
    disintegratePhase,
    kind: 'enemy',
    target: {
      active: actor.lifeState === 'alive'
        && ('config' in actor || actor.combatActive),
      actorFlags: 'config' in actor ? boneyardEnemyActorFlags(actor) : 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: 'config' in actor ? boneyardEnemyCollisionRadius(actor) : actor.collisionRadius,
      cellBindingOrder: actor.nativeCellBindingOrder,
      id: `enemy:${actor.id}`,
      headingDeg: actor.headingDeg,
      kind: 'enemy',
      nativePriority: 0,
      queryLane: 'grid' as const,
      pendingRemove: false,
      position: { ...actor.position },
      registrationOrder: actor.nativeRegistrationOrder,
    },
  }))
}

export function primaryWaterTargetRows(
  store: BoneyardEnemyStore,
): readonly PrimaryWaterTargetRow[] {
  const enemies = primaryTargetRows(store)
  const arrows = store.projectiles
    .filter((projectile) => projectile.kind === 'arrow')
    .map((projectile): PrimaryProjectileTargetRow => ({
      kind: 'arrow',
      projectile,
      target: {
        active: projectile.ageTicks < projectile.lifetimeTicks,
        actorFlags: 0x80,
        attachment: { x: 0, y: 0 },
        bodyRadius: projectile.contactRadius,
        cellBindingOrder: projectile.nativeCellBindingOrder,
        id: `projectile:${projectile.id}`,
        kind: 'projectile',
        nativePriority: 0,
        queryLane: 'transient',
        pendingRemove: false,
        position: { ...projectile.position },
        registrationOrder: projectile.painterRegistration.registrationOrdinal,
      },
    }))
  const silks = store.silks.map((projectile): PrimarySilkTargetRow => ({
    kind: 'silk', projectile,
    target: {
      active: true, actorFlags: 0x1000, attachment: { x: 0, y: 0 },
      bodyRadius: 15, cellBindingOrder: projectile.nativeCellBindingOrder,
      id: `silk:${projectile.id}`, kind: 'projectile', nativePriority: 0,
      queryLane: 'grid' as const,
      pendingRemove: false, position: { ...projectile.state.position },
      registrationOrder: projectile.nativeRegistrationOrder,
    },
  }))
  return [...enemies, ...arrows, ...silks]
}

export function primaryBlizzardTargetRows(
  store: BoneyardEnemyStore,
  sceneryTargets: readonly PrimarySpellTarget[],
): readonly PrimaryBlizzardTargetRow[] {
  const scenery = sceneryTargets.map((target): PrimarySceneryTargetRow => ({
    actor: null,
    kind: 'scenery',
    target,
  }))
  return [...scenery, ...primaryWaterTargetRows(store)]
}

export function bySpellId(
  left: Readonly<{ id: number }>,
  right: Readonly<{ id: number }>,
): number {
  return left.id - right.id
}

export function squaredDistance(
  left: Readonly<Vector2>,
  right: Readonly<Vector2>,
): number {
  const deltaX = left.x - right.x
  const deltaY = left.y - right.y
  return deltaX * deltaX + deltaY * deltaY
}
