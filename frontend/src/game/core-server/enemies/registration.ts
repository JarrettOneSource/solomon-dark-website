import type {
  BoneyardPoint,
} from '../../core-kernels/boneyard.ts'
import {
  nativePrimaryCellCoordinate,
} from '../../core-kernels/primary-spell-targeting.ts'
import {
  type BoneyardEnemyStore,
  type BoneyardEnemyTargets,
  type BoneyardPuppetTarget,
  type WorkingStep,
} from './model.ts'

export function standaloneEnemyWorldManagerOrderState(source: BoneyardEnemyStore) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of [
    ...source.bossSpells.map(({ painterRegistration }) => painterRegistration),
    ...source.actors.map(({ lightRegistration }) => lightRegistration),
    ...source.maggots.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.map(({ painterRegistration }) => painterRegistration),
    ...source.silks.map(({ painterRegistration }) => painterRegistration),
    ...source.projectileEffects.map(({ lightRegistration }) => lightRegistration),
    ...source.projectileEffects.map(({ painterRegistration }) => painterRegistration),
    ...source.deathEffects.map(({ painterRegistration }) => painterRegistration),
    ...source.mageLightningPulses.flatMap(({ painterRegistrations }) => painterRegistrations),
  ]) {
    if (registration === null) continue
    nextRegistrationOrdinal[registration.managerLane] = Math.max(
      nextRegistrationOrdinal[registration.managerLane],
      registration.registrationOrdinal + 1,
    )
  }
  return { nextRegistrationOrdinal }
}

interface NativeCellBoundActor {
  readonly nativeCellBindingOrder: number
  readonly position: Readonly<BoneyardPoint>
}

export function withNativeCellRebindOrder<T extends NativeCellBoundActor>(
  work: WorkingStep,
  before: NativeCellBoundActor,
  after: T,
): T {
  if (!nativePrimaryCellChanged(before.position, after.position)) return after
  const rebound = {
    ...after,
    nativeCellBindingOrder: work.nextNativeCellBindingOrder,
  }
  work.nextNativeCellBindingOrder += 1
  return rebound
}

export function nativePrimaryCellChanged(
  before: Readonly<BoneyardPoint>,
  after: Readonly<BoneyardPoint>,
): boolean {
  return nativePrimaryCellCoordinate(before.x) !== nativePrimaryCellCoordinate(after.x)
    || nativePrimaryCellCoordinate(before.y) !== nativePrimaryCellCoordinate(after.y)
}

export function bindEnemyTargets(work: WorkingStep, targets: BoneyardEnemyTargets): void {
  for (const [id, target] of Object.entries(targets)) bindNativeQueryTarget(work, id, target.position)
}

export type NativeQueryBindingWork = Pick<WorkingStep, 'targetCellBindings' | 'nextNativeCellBindingOrder'>

export function bindNativeQueryTarget(work: NativeQueryBindingWork, id: string, position: Readonly<BoneyardPoint>): void {
  const cellX = nativePrimaryCellCoordinate(position.x)
  const cellY = nativePrimaryCellCoordinate(position.y)
  const previous = work.targetCellBindings[id]
  if (previous?.cellX === cellX && previous.cellY === cellY) return
  work.targetCellBindings = { ...work.targetCellBindings,
    [id]: { cellX, cellY, order: work.nextNativeCellBindingOrder++ } }
}

export function bindWorldPuppetTargets(work: NativeQueryBindingWork, targets: readonly BoneyardPuppetTarget[]): void {
  for (const target of [...targets].filter(target => target.hitKind === 'meteor' || target.hitKind === 'leviathan')
    .sort((left, right) => left.registrationOrder - right.registrationOrder)) {
    bindNativeQueryTarget(work, target.id, target.gridPosition ?? target.position)
  }
}
