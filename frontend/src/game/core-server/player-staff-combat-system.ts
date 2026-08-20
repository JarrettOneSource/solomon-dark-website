import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type WizardElement,
} from '../core-kernels/player-character.ts'
import {
  NATIVE_STAFF_KNOCKBACK_DAZZLE_TICKS,
  createNativePlayerStaffAction,
  createNativeStaffContactKnockback,
  createNativeStaffContactPresentation,
  createNativeStaffKnockback,
  createNativeStaffPikeBreakVfx,
  isNativePlayerStaffTransient,
  nativeStaffAdmissionTarget,
  nativeStaffContactDamagePerTarget,
  nativeStaffDamageTargets,
  nativeStaffKnockbackTargets,
  nativeStaffPhysicalContactTargets,
  resolveNativeStaffPhysicalContacts,
  stepNativeStaffContactKnockback,
  stepNativeStaffPikeBreakVfx,
  stepNativePlayerStaffAction,
  stepNativePlayerStaffVfx,
  stepNativeStaffContactEvent,
  stepNativeStaffKnockback,
  type NativePlayerStaffAction,
  type NativeStaffTarget,
} from '../core-kernels/native-player-staff-action.ts'
import {
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import { playerStaffDamage, togglePlayerStaffMeleeLane } from '../core-kernels/player-skill-runtime.ts'
import type {
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  applyBoneyardStaffDisable,
  applyBoneyardStaffImpactVerticalVelocity,
  breakBoneyardSkeletonPike,
  damageBoneyardEnemy,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  playerProgressionAt,
  playerSkillBookAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  setPlayerEntitySkillRuntime,
  type PlayerEntityStore,
} from './player-entity-store.ts'

export interface PlayerStaffCombatSystemContext {
  readonly enemies: BoneyardEnemyStore
  readonly inputs: Readonly<Record<string, PlayerCharacterInput>>
  readonly knockbackTargetVisible: (
    origin: Readonly<Vector2>,
    target: Readonly<Vector2>,
  ) => boolean
  readonly playerEntities: PlayerEntityStore
  readonly players: Readonly<Record<string, PlayerCharacterState>>
  readonly rng: NativeRngState
  readonly spells: PrimarySpellSimulationState
  readonly tick: number
  readonly worldKey: string
}

export interface PlayerStaffCombatSystemResult {
  readonly actingPlayerIds: ReadonlySet<string>
  readonly dazzleRequests: readonly Readonly<{
    durationTicks: number
    targetId: number
  }>[]
  readonly displacements: readonly Readonly<{
    actorId: number
    delta: Readonly<Vector2>
  }>[]
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly headingPerturbations: readonly Readonly<{
    actorId: number
    headingDegrees: number
  }>[]
  readonly playerEntities: PlayerEntityStore
  readonly pikeBreakFeedback: readonly Readonly<{
    ownerId: string
    position: Readonly<Vector2>
    worldKey: string
  }>[]
  readonly players: Readonly<Record<string, PlayerCharacterState>>
  readonly rng: NativeRngState
  readonly spells: PrimarySpellSimulationState
}

interface StaffCombatTarget extends NativeStaffTarget {
  readonly actorId: number
  readonly headingDegrees: number
  readonly pike: boolean
}

export function stepPlayerStaffCombatSystem(
  context: PlayerStaffCombatSystemContext,
): PlayerStaffCombatSystemResult {
  let enemies = context.enemies
  let playerEntities = context.playerEntities
  let players: Readonly<Record<string, PlayerCharacterState>> = context.players
  let rng = context.rng
  let nextId = context.spells.nextId
  const retained: PrimarySpellTransientState[] = []
  const spawned: PrimarySpellTransientState[] = []
  const displacements: Array<{ actorId: number; delta: Readonly<Vector2> }> = []
  const dazzleRequests: Array<{ durationTicks: number; targetId: number }> = []
  const headingPerturbations: Array<{ actorId: number; headingDegrees: number }> = []
  const events: BoneyardEnemySemanticEvent[] = []
  const pikeBreakFeedback: Array<{
    ownerId: string
    position: Readonly<Vector2>
    worldKey: string
  }> = []
  const actingPlayerIds = new Set<string>()
  const existingActionOwners = new Set<string>()

  for (const transient of context.spells.transients) {
    if (!isNativePlayerStaffTransient(transient)) {
      retained.push(transient)
      continue
    }
    if (transient.kind === 'player-staff-contact') {
      const stepped = stepNativeStaffContactEvent(transient)
      if (stepped !== null) retained.push(stepped)
      continue
    }
    if (transient.kind === 'player-staff-contact-knockback') {
      const targetId = parseEnemyTargetId(transient.targetId)
      const targetExists = targetId !== null && staffCombatTargets(enemies).some((target) => (
        target.actorId === targetId
      ))
      const stepped = stepNativeStaffContactKnockback(transient, targetExists)
      if (targetId !== null && stepped.displacement !== null) {
        displacements.push({ actorId: targetId, delta: stepped.displacement })
      }
      if (stepped.actor !== null) retained.push(stepped.actor)
      continue
    }
    if (transient.kind === 'player-staff-pike-break') {
      const stepped = stepNativeStaffPikeBreakVfx(transient)
      if (stepped !== null) retained.push(stepped)
      continue
    }
    if (
      transient.kind === 'player-staff-smoke'
      || transient.kind === 'player-staff-move-fade'
      || transient.kind === 'player-staff-perspective-fade'
    ) {
      const stepped = stepNativePlayerStaffVfx(transient)
      if (stepped !== null) retained.push(stepped)
      continue
    }
    if (transient.kind === 'player-staff-knockback') {
      const targets = staffCombatTargets(enemies)
      const positions = Object.fromEntries(targets.map((target) => [
        target.id,
        target.position,
      ]))
      const stepped = stepNativeStaffKnockback(transient, positions, rng)
      rng = stepped.rng
      for (const displacement of stepped.displacements) {
        const actorId = parseEnemyTargetId(displacement.targetId)
        if (actorId !== null) displacements.push({ actorId, delta: displacement.delta })
      }
      for (const targetId of stepped.dazzledTargetIds) {
        const actorId = parseEnemyTargetId(targetId)
        if (actorId !== null) {
          dazzleRequests.push({
            durationTicks: NATIVE_STAFF_KNOCKBACK_DAZZLE_TICKS,
            targetId: actorId,
          })
        }
      }
      for (const perturbation of stepped.headingPerturbations) {
        const actorId = parseEnemyTargetId(perturbation.targetId)
        if (actorId !== null) {
          headingPerturbations.push({
            actorId,
            headingDegrees: perturbation.headingDegrees,
          })
        }
      }
      if (stepped.actor !== null) retained.push(stepped.actor)
      continue
    }

    existingActionOwners.add(transient.ownerId)
    const owner = players[transient.ownerId]
    if (owner === undefined) continue
    actingPlayerIds.add(transient.ownerId)
    const stepped = stepNativePlayerStaffAction(transient, owner.position)
    const nextOwner = {
      ...owner,
      headingIndex: normalizedHeadingIndex(stepped.sample.headingDegrees),
    }
    players = { ...players, [transient.ownerId]: nextOwner }
    if (stepped.contact) {
      // Retail builds the contact candidate list before applying damage. A
      // lethal hit does not retroactively remove that actor from the same
      // callback's Knockback constructor/query.
      const preContactTargets = staffCombatTargets(enemies)
      const selected = selectStaffContactTargets(
        enemies,
        playerEntities,
        stepped.sample,
        rng,
      )
      rng = selected.rng
      const physicalTargets = nativeStaffPhysicalContactTargets({
        collisionRadius: PLAYER_CHARACTER_RADIUS,
        headingDegrees: stepped.sample.headingDegrees,
        position: stepped.sample.origin,
      }, preContactTargets)
      const physical = resolveNativeStaffPhysicalContacts(
        stepped.sample,
        physicalTargets,
        owner.config.element,
        playerSkillDerivedStatsAt(playerEntities, transient.ownerId)?.staffDamageSecondary ?? 0,
        rng,
      )
      rng = physical.rng
      const impactSoundPitches: number[] = []
      const pikeBreakSoundIndexes: number[] = []
      for (const impact of physical.impacts) {
        impactSoundPitches.push(impact.soundPitch)
        const actorId = parseEnemyTargetId(impact.targetId)
        if (actorId === null) continue
        enemies = applyBoneyardStaffImpactVerticalVelocity(
          enemies,
          actorId,
          impact.verticalVelocity,
        )
        if (impact.pikeBreakPresentationRng !== null) {
          const target = preContactTargets.find((candidate) => candidate.actorId === actorId)
          const broken = breakBoneyardSkeletonPike(enemies, actorId)
          enemies = broken.store
          if (broken.broke && target !== undefined) {
            pikeBreakSoundIndexes.push(impactSoundPitches.length - 1)
            pikeBreakFeedback.push(Object.freeze({
              ownerId: stepped.sample.ownerId,
              position: Object.freeze({ ...target.position }),
              worldKey: stepped.sample.worldKey,
            }))
            spawned.push(createNativeStaffPikeBreakVfx(
              nextId,
              stepped.sample,
              target,
              impact.pikeBreakPresentationRng,
              target.headingDegrees,
            ))
            nextId += 1
          }
        }
        if (impact.contactKnockbackDelta !== null) {
          spawned.push(createNativeStaffContactKnockback(
            nextId,
            stepped.sample,
            impact.targetId,
            impact.contactKnockbackDelta,
          ))
          nextId += 1
        }
      }
      const contact = applyStaffContact(
        enemies,
        playerEntities,
        stepped.sample,
        selected.targets,
        context.tick,
      )
      enemies = contact.enemies
      events.push(...contact.events)

      if (contact.targets.length > 0) {
        const knockbackTargets = nativeStaffKnockbackTargets(
          stepped.sample,
          preContactTargets,
        ).filter((target) => context.knockbackTargetVisible(
          stepped.sample.origin,
          target.position,
        ))
        const knockback = createNativeStaffKnockback(
          nextId,
          stepped.sample,
          knockbackTargets.map(({ id }) => id),
        )
        if (knockback !== null) {
          spawned.push(knockback)
          nextId += 1
        }
      }
      const presentation = createNativeStaffContactPresentation(
        nextId,
        stepped.sample,
        contact.targets.map(({ id }) => id),
        meanTargetPosition(contact.targets, stepped.sample.origin),
        playerElementTint(owner.config.element),
        rng,
        impactSoundPitches,
        pikeBreakSoundIndexes,
      )
      rng = presentation.rng
      nextId = presentation.nextId
      spawned.push(...presentation.vfx, presentation.event)
    }
    if (stepped.action !== null) retained.push(stepped.action)
  }

  for (const [playerId, player] of Object.entries(players)) {
    if (existingActionOwners.has(playerId)) continue
    const progression = playerProgressionAt(playerEntities, playerId)
    const runtime = playerSkillRuntimeAt(playerEntities, playerId)
    const derived = playerSkillDerivedStatsAt(playerEntities, playerId)
    const input = context.inputs[playerId]
    if (
      progression === null
      || progression.lifeState !== 'alive'
      || progression.pendingOffer !== null
      || runtime === null
      || derived === null
      || !derived.staffEquipped
      || player.primaryCast.actionTick >= 0
      || player.primaryCast.channelActive
      || input?.cast.primary === true
      || input?.cast.secondary != null
    ) continue
    const admitted = nativeStaffAdmissionTarget({
      collisionRadius: PLAYER_CHARACTER_RADIUS,
      headingDegrees: player.headingIndex * 15,
      position: player.position,
    }, staffCombatTargets(enemies))
    if (admitted === null) continue
    const action = createNativePlayerStaffAction({
      derived,
      headingDegrees: player.headingIndex * 15,
      id: nextId,
      lane: runtime.staffMeleeAlternate ? 'secondary' : 'primary',
      origin: player.position,
      ownerId: playerId,
      worldKey: context.worldKey,
    }, rng)
    rng = action.rng
    nextId += 1
    spawned.push(action.action)
    actingPlayerIds.add(playerId)
    if (action.action.kind === 'player-staff-melee') {
      playerEntities = setPlayerEntitySkillRuntime(
        playerEntities,
        playerId,
        togglePlayerStaffMeleeLane(runtime),
      )
    }
  }

  return Object.freeze({
    actingPlayerIds,
    dazzleRequests: Object.freeze(dazzleRequests),
    displacements: Object.freeze(displacements),
    enemies,
    events: Object.freeze(events),
    headingPerturbations: Object.freeze(headingPerturbations),
    playerEntities,
    pikeBreakFeedback: Object.freeze(pikeBreakFeedback),
    players,
    rng,
    spells: {
      ...context.spells,
      nextId,
      transients: Object.freeze([...retained, ...spawned]),
    },
  })
}

function applyStaffContact(
  source: BoneyardEnemyStore,
  playerEntities: PlayerEntityStore,
  action: NativePlayerStaffAction,
  targets: readonly StaffCombatTarget[],
  tick: number,
): Readonly<{
  enemies: BoneyardEnemyStore
  events: readonly BoneyardEnemySemanticEvent[]
  targets: readonly StaffCombatTarget[]
}> {
  const runtime = playerSkillRuntimeAt(playerEntities, action.ownerId)
  const derived = playerSkillDerivedStatsAt(playerEntities, action.ownerId)
  const progression = playerProgressionAt(playerEntities, action.ownerId)
  if (runtime === null || derived === null || progression === null) {
    return { enemies: source, events: [], targets: [] }
  }
  if (targets.length === 0) {
    return { enemies: source, events: [], targets: [] }
  }
  const totalDamage = playerStaffDamage(runtime, derived, progression, action.outcome)
  const damage = nativeStaffContactDamagePerTarget(
    totalDamage,
    targets.length,
    action.outcome === 'whirl',
  )
  let enemies = source
  const events: BoneyardEnemySemanticEvent[] = []
  const acceptedTargets: StaffCombatTarget[] = []
  for (const target of targets) {
    const damaged = damageBoneyardEnemy(enemies, {
      actorId: target.actorId,
      amount: damage,
      sourcePlayerId: action.ownerId,
      tick,
    })
    if (!damaged.accepted) continue
    enemies = damaged.store
    events.push(...damaged.events)
    acceptedTargets.push(target)
    if (action.outcome === 'disabling-hit') {
      enemies = applyBoneyardStaffDisable(enemies, target.actorId)
    }
  }
  return Object.freeze({
    enemies,
    events: Object.freeze(events),
    targets: Object.freeze(acceptedTargets),
  })
}

function selectStaffContactTargets(
  source: BoneyardEnemyStore,
  playerEntities: PlayerEntityStore,
  action: NativePlayerStaffAction,
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; targets: readonly StaffCombatTarget[] }> {
  const skillBook = playerSkillBookAt(playerEntities, action.ownerId)
  if (skillBook === null) return { rng: sourceRng, targets: [] }
  let rng = sourceRng
  let targets = [...nativeStaffDamageTargets(action, staffCombatTargets(source))]
  if (
    action.outcome !== 'critical-hit'
    && action.outcome !== 'whirl'
    && (skillBook.effectiveRanks[65] ?? 0) === 0
    && targets.length > 0
  ) {
    const selected = drawNativeInteger(rng, targets.length)
    rng = selected.state
    targets = [targets[selected.value]!]
  }
  return Object.freeze({ rng, targets: Object.freeze(targets) })
}

function staffCombatTargets(enemies: BoneyardEnemyStore): StaffCombatTarget[] {
  return [
    ...enemies.actors.flatMap((actor): StaffCombatTarget[] => (
      actor.lifeState === 'alive' && actor.config.enemyToken !== 'COFFIN'
        ? [{
            actorId: actor.id,
            collisionRadius: actor.config.collisionRadius,
            headingDegrees: actor.headingDeg,
            id: `enemy:${actor.id}`,
            pike: actor.brain.family === 'skeleton'
              && actor.config.flags.includes('FLAG_PIKE'),
            position: actor.position,
          }]
        : []
    )),
    ...enemies.maggots.flatMap((maggot): StaffCombatTarget[] => (
      maggot.lifeState === 'alive'
        ? [{
            actorId: maggot.id,
            collisionRadius: maggot.collisionRadius,
            headingDegrees: maggot.headingDeg,
            id: `enemy:${maggot.id}`,
            pike: false,
            position: maggot.position,
          }]
        : []
    )),
  ].sort((first, second) => first.actorId - second.actorId)
}

function meanTargetPosition(
  targets: readonly StaffCombatTarget[],
  fallback: Readonly<Vector2>,
): Vector2 {
  if (targets.length === 0) return { ...fallback }
  return {
    x: targets.reduce((sum, target) => sum + target.position.x, 0) / targets.length,
    y: targets.reduce((sum, target) => sum + target.position.y, 0) / targets.length,
  }
}

function parseEnemyTargetId(targetId: string): number | null {
  if (!targetId.startsWith('enemy:')) return null
  const actorId = Number(targetId.slice('enemy:'.length))
  return Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null
}

function normalizedHeadingIndex(headingDegrees: number): number {
  return Math.floor((((headingDegrees % 360) + 360) % 360 + 7.5) / 15) % 24
}

function playerElementTint(element: WizardElement): number {
  switch (element) {
    case 'air': return 0xa0c3c3
    case 'earth': return 0x90b390
    case 'ether': return 0x886688
    case 'fire': return 0x998077
    case 'water': return 0x5e6e81
  }
}
