import { receiveNativePuppetHit, stepNativePuppetHit, type NativeWorldPuppetHit } from '../../core-kernels/native-puppet-hit.ts'
import { boneyardMouthWorldTargets, boneyardPuppetTarget } from '../boneyard-world-targets.ts'
import type { BoneyardLightEnvironment } from '../boneyard-world-light.ts'
import type { BoneyardWorldState } from '../boneyard-world-state.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { primaryTargetRows } from '../spell-combat/targets.ts'
import type { BoneyardEnemyStoreStepContext, BoneyardPuppetTarget, WorkingStep } from './model.ts'
import { targetEligible } from './targeting.ts'
import { bindNativeQueryTarget, bindWorldPuppetTargets } from './registration.ts'

export function boneyardMouthTargets(
  work: WorkingStep, context: BoneyardEnemyStoreStepContext, casterId: number,
): BoneyardPuppetTarget[] {
  const targets: BoneyardPuppetTarget[] = primaryTargetRows(work)
    .filter(({ actor }) => actor.id !== casterId)
    .map(({ target }) => ({ ...target, hitKind: null }))
  for (const [id, player] of Object.entries(context.players)) {
    if (!targetEligible(player)) continue
    const order = work.targetCellBindings[id]!.order
    targets.push(boneyardPuppetTarget(`target:${id}`, player.position, player.summoned ? 0x800 : 1, order, null))
  }
  for (const target of context.puppetTargets ?? []) {
    const binding = work.targetCellBindings[target.id]
    targets.push(binding ? { ...target, cellBindingOrder: binding.order } : target)
  }
  for (const projectile of work.projectiles) {
    if (projectile.kind === 'arrow' || projectile.kind === 'firebolt') {
      targets.push(boneyardPuppetTarget(`projectile:${projectile.id}`, projectile.position,
        projectile.kind === 'arrow' ? 0x80 : 0x100, projectile.painterRegistration.registrationOrdinal,
        projectile.kind, 'transient'))
    } else if (projectile.kind === 'guided-missile') {
      targets.push({ ...boneyardPuppetTarget(`projectile:${projectile.id}`, projectile.position,
        0x100, projectile.nativeRegistrationOrder, null), cellBindingOrder: projectile.nativeCellBindingOrder })
    }
  }
  for (const silk of work.silks) {
    targets.push({ ...boneyardPuppetTarget(`silk:${silk.id}`, silk.state.position, 0x1000,
      silk.nativeRegistrationOrder, null), cellBindingOrder: silk.nativeCellBindingOrder })
  }
  for (const spell of work.bossSpells) {
    if (spell.kind === 'eye-laser') {
      targets.push(boneyardPuppetTarget(`boss-spell:${spell.id}`, spell.position, 0x100,
        spell.painterRegistration.registrationOrdinal, null, 'transient'))
    } else if (spell.kind === 'skull-missile') {
      targets.push({ ...boneyardPuppetTarget(`boss-spell:${spell.id}`, spell.position, 0x100,
        spell.painterRegistration.registrationOrdinal, null),
        cellBindingOrder: work.targetCellBindings[`boss-spell:${spell.id}`]!.order })
    }
  }
  return targets
}

export function hitBoneyardPuppet(work: WorkingStep, target: BoneyardPuppetTarget, tick: number, strength: number): void {
  if (target.hitKind === null) return
  const hit: NativeWorldPuppetHit = { targetId: target.id, kind: target.hitKind, hitTick: tick, feedback: receiveNativePuppetHit(tick, strength) }
  const index = work.puppetHits.findIndex(current => current.targetId === target.id)
  if (index < 0) work.puppetHits.push(hit)
  else work.puppetHits[index] = hit
}

export function retainBoneyardPuppetHits(
  hits: readonly NativeWorldPuppetHit[], targets: readonly BoneyardPuppetTarget[],
): NativeWorldPuppetHit[] {
  const owners = new Map(targets.map(target => [target.id, target.hitKind]))
  return hits.filter(hit => owners.get(hit.targetId) === hit.kind && hit.feedback.timer > 0)
}

export function stepBoneyardPuppetHits(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  if (work.puppetHits.length === 0) return
  work.puppetHits = retainBoneyardPuppetHits(work.puppetHits, boneyardMouthTargets(work, context, -1))
    .map(hit => hit.kind === 'meteor' || hit.kind === 'leviathan' ? hit
      : { ...hit, feedback: stepNativePuppetHit(hit.feedback, context.tick) })
    .filter(hit => hit.feedback.timer > 0)
}

/** Commit bindings made by the later player-spell phase before the next actor pass. */
export function finalizeBoneyardPuppetQueries(
  world: BoneyardWorldState, players: Readonly<Record<string, { readonly position: Readonly<BoneyardPoint> }>>,
  environment: BoneyardLightEnvironment,
): BoneyardWorldState {
  const binding = { targetCellBindings: world.enemies.targetCellBindings,
    nextNativeCellBindingOrder: world.enemies.nextNativeCellBindingOrder }
  const targets = boneyardMouthWorldTargets(world, environment)
  const liveBindings = new Set(Object.keys(players))
  for (const [id, player] of Object.entries(players)) bindNativeQueryTarget(binding, id, player.position)
  for (const actor of environment.secondaryAbilities?.actors ?? []) {
    if (actor.kind !== 'golem' || actor.worldKey !== `boneyard:${world.runId}`) continue
    const id = `golem:${actor.id}`
    liveBindings.add(id)
    bindNativeQueryTarget(binding, id, actor.position)
  }
  bindWorldPuppetTargets(binding, targets)
  for (const target of targets) {
    if (target.hitKind === 'meteor' || target.hitKind === 'leviathan') liveBindings.add(target.id)
  }
  for (const spell of world.enemies.bossSpells) {
    if (spell.kind !== 'skull-missile') continue
    const id = `boss-spell:${spell.id}`
    liveBindings.add(id)
    bindNativeQueryTarget(binding, id, spell.position)
  }
  for (const projectile of world.enemies.projectiles) {
    if (projectile.kind !== 'arrow' && projectile.kind !== 'firebolt') continue
    targets.push(boneyardPuppetTarget(`projectile:${projectile.id}`, projectile.position,
      projectile.kind === 'arrow' ? 0x80 : 0x100, projectile.painterRegistration.registrationOrdinal,
      projectile.kind, 'transient'))
  }
  return { ...world, enemies: { ...world.enemies,
    targetCellBindings: Object.fromEntries(Object.entries(binding.targetCellBindings).filter(([id]) => liveBindings.has(id))),
    nextNativeCellBindingOrder: binding.nextNativeCellBindingOrder,
    puppetHits: retainBoneyardPuppetHits(world.enemies.puppetHits, targets),
  } }
}
