import type { PendingPlayerHardenChip } from './player-harden-effects.ts'
import type { BoneyardWorldState } from './boneyard-world.ts'
import { playerPoisonHealthDamage } from '../core-kernels/player-combat.ts'
import { emitPlayerStatusBurst } from './boneyard-player-status.ts'
import {
  NATIVE_FLASH_RESPONSE_RADIUS,
  playerDeflectReflectionSourceInRange,
  resolvePlayerHarmfulContact,
  resolvePlayerFlashResponse,
} from '../core-kernels/player-harmful-contact.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from '../core-kernels/actor-heading.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import { playerPoisonDurationSeconds } from '../core-kernels/player-skill-runtime.ts'
import {
  applyNativeSecondaryGolemDamage,
  applyNativeSecondaryPlayerDamage,
  materializeNativePlayerFlashResponse,
  type NativeSecondarySimulationState,
} from '../core-kernels/native-secondary-abilities.ts'
import { NATIVE_GOLEM_REFLECT_DISTANCE_SQUARED } from '../core-kernels/native-secondary-golem.ts'
import { boneyardNativeSecondaryTargets } from './native-secondary-world.ts'
import {
  boneyardEnemyCollisionRadius,
  emitBoneyardPlayerDamageSound,
  nativeWizardOuchCooldownReady,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyPlayerDamage,
} from './boneyard-enemy-store.ts'
import {
  damagePlayerEntityWithResult,
  playerEntityIndex,
  playerSkillDerivedStatsAt,
  type PlayerEntityStore,
} from './player-entity-store.ts'
import type { GameSimulationState, GameWorldState, GameSimulationExtensions, PlayerId } from './game-simulation.ts'

export interface PlayerContactStep {
  readonly hardenChips: readonly PendingPlayerHardenChip[]
  readonly world: GameWorldState
  readonly playerEntities: PlayerEntityStore
  readonly secondaryAbilities: NativeSecondarySimulationState
  readonly resolvedPlayers: Readonly<Record<PlayerId, PlayerCharacterState>>
  readonly appliedPlayerDamage: readonly BoneyardEnemyPlayerDamage[]
  readonly reflectedEnemyDamage: readonly Readonly<{ actorId: number; amount: number; playerId: string }>[]
  readonly deflectPitchesByEventId: ReadonlyMap<number, number>
  readonly playerDamageSoundEvents: readonly BoneyardEnemySemanticEvent[]
}

export function applyPlayerContacts(
  source: Pick<GameSimulationState, 'world' | 'playerEntities' | 'secondaryAbilities'>,
  players: Readonly<Record<PlayerId, PlayerCharacterState>>,
  playerDamage: readonly BoneyardEnemyPlayerDamage[],
  tick: number,
  extensions: GameSimulationExtensions | undefined,
): PlayerContactStep {
  const initialWorld = source.world
  let playerEntities = source.playerEntities
  let secondaryAbilities = source.secondaryAbilities
  let resolvedPlayers = players
  const hardenChips: PendingPlayerHardenChip[] = []
  const playerDamageSoundEvents: BoneyardEnemySemanticEvent[] = []
  const appliedPlayerDamage: (typeof playerDamage)[number][] = []
  const admittedStatusKinds = new Map<string, Set<'cold' | 'poison'>>()
  const reflectedEnemyDamage: Array<Readonly<{
    actorId: number
    amount: number
    playerId: string
  }>> = []
  const deflectPitchesByEventId = new Map<number, number>()
  if (initialWorld.kind === 'hub') return { world: initialWorld, hardenChips, playerEntities, secondaryAbilities, resolvedPlayers,
    appliedPlayerDamage, reflectedEnemyDamage, deflectPitchesByEventId, playerDamageSoundEvents }
  let world = initialWorld
  for (const damage of playerDamage) {
    if (world.tutorial?.damageProtection) continue
    const golemId = damage.playerId.startsWith('golem:') ? Number(damage.playerId.slice(6)) : null
    if (golemId !== null) applyGolemContact(damage, golemId)
    else applyPlayerContact(damage)
  }
  return { world, hardenChips, playerEntities, secondaryAbilities, resolvedPlayers,
    appliedPlayerDamage, reflectedEnemyDamage, deflectPitchesByEventId, playerDamageSoundEvents }

  function applyGolemContact(damage: BoneyardEnemyPlayerDamage, golemId: number): void {
    const golem = secondaryAbilities.actors.find(({ id, kind }) => (
      id === golemId && kind === 'golem'
    ))
    if (!golem) return
    const damageSource = playerContactSource(world, damage.actorId)
    const sourceInReflectRange = damageSource !== undefined
      && squaredVectorDistance(damageSource.position, golem.position)
        < NATIVE_GOLEM_REFLECT_DISTANCE_SQUARED
    const received = applyNativeSecondaryGolemDamage(
      secondaryAbilities,
      golemId,
      {
        primaryDamage: damage.physicalDamage,
        reflectablePhysicalSourceInRange: damage.physicalDamage > 0
          && sourceInReflectRange,
        secondaryDamage: damage.magicDamage,
      },
      tick,
    )
    secondaryAbilities = received.state
    if (received.reflectedDamage > 0 && received.ownerId !== null) {
      reflectedEnemyDamage.push(Object.freeze({
        actorId: damage.actorId,
        amount: received.reflectedDamage,
        playerId: received.ownerId,
      }))
    }
  }

  function applyPlayerContact(damage: BoneyardEnemyPlayerDamage): void {
    const character = resolvedPlayers[damage.playerId]
    const playerIndex = playerEntityIndex(playerEntities, damage.playerId)
    if (character === undefined || playerIndex < 0) return
    const damageSource = playerContactSource(world, damage.actorId)
    const runtime = playerEntities.skillRuntimes[playerIndex]!
    const derived = playerSkillDerivedStatsAt(playerEntities, damage.playerId)!
    const progression = playerEntities.progressions[playerIndex]!
    const contact = resolvePlayerHarmfulContact(
      runtime,
      derived,
      progression,
      damage,
      damageSource !== undefined
        && playerDeflectReflectionSourceInRange(
          character.position,
          PLAYER_CHARACTER_RADIUS,
          damageSource.position,
          'config' in damageSource
            ? boneyardEnemyCollisionRadius(damageSource)
            : damageSource.collisionRadius,
        ),
      secondaryAbilities.rng,
      character.position,
    )
    secondaryAbilities = { ...secondaryAbilities, rng: contact.rng }
    if (contact.hardenChip !== null) hardenChips.push({
      chip: contact.hardenChip, ownerId: damage.playerId,
      position: character.position, worldKey: gameWorldKey(world, damage.playerId),
    })
    if (contact.deflected) {
      deflectPitchesByEventId.set(damage.eventId, contact.deflectPitch)
      if (damageSource !== undefined) {
        resolvedPlayers = {
          ...resolvedPlayers,
          [damage.playerId]: {
            ...character,
            headingIndex: actorHeadingIndex(actorHeadingFromVector(
              damageSource.position.x - character.position.x,
              damageSource.position.y - character.position.y,
            )),
          },
        }
      }
      if (contact.reflectedDamage > 0) {
        reflectedEnemyDamage.push(Object.freeze({
          actorId: damage.actorId,
          amount: contact.reflectedDamage,
          playerId: damage.playerId,
        }))
      }
      return
    }
    const shieldActive = (secondaryAbilities.players[damage.playerId]?.magicShieldAbsorb ?? 0) > 0
    const intercepted = applyNativeSecondaryPlayerDamage(
      secondaryAbilities,
      damage.playerId,
      contact.shieldDamage,
      tick,
      character.position,
      gameWorldKey(world, damage.playerId),
    )
    secondaryAbilities = intercepted.state
    const physicalDamage = intercepted.absorbedDamage > 0 ? 0 : contact.physicalDamage
    const magicDamage = intercepted.absorbedDamage > 0 ? 0 : contact.magicDamage
    const { healthDamage, rejectedContact, cappedPoisonDamage, filteredHealthDamage, poisonContactDamage } =
      filterHealthDamage()
    const stoneskin = (secondaryAbilities.players[damage.playerId]?.stoneskinTicksRemaining ?? 0) > 0
    applyStatusModifiers()
    const before = progression
    playerEntities = damagePlayerEntityWithResult(
      playerEntities,
      damage.playerId,
      healthDamage,
      tick,
      true,
      !damage.suppressHitResponse,
    ).store
    const after = playerEntities.progressions[playerIndex]!
    playHurtResponse()
    applyFlashResponse()

    function filterHealthDamage() {
      const resistedDamage = physicalDamage + magicDamage
      let filteredHealthDamage = 0
      for (const [amount, damageKind] of [[physicalDamage, 'physical'], [magicDamage, 'magic']] as const) {
        if (amount === 0) continue
        filteredHealthDamage += extensions ? Math.max(0, finiteModMutation(extensions.filterDamage({
          amount, damageKind, sourceActorId: damage.actorId, targetPlayerId: damage.playerId, tick,
        }), 'filtered enemy damage')) : amount
      }
      const poisonContactDamage = progression.poisonImmunityTicksRemaining > 0
        ? 0
        : Math.fround((damage.poisonContactDamage ?? 0)
            * derived.poisonDamageFactor
            * derived.incomingDamageFactor)
      const filteredPoisonDamage = extensions && poisonContactDamage > 0
        ? extensions.filterDamage({
            amount: poisonContactDamage,
            damageKind: 'poison',
            sourceActorId: damage.actorId,
            targetPlayerId: damage.playerId,
            tick,
          })
        : poisonContactDamage
      const filteredPoisonContactDamage = Math.max(0,
        finiteModMutation(filteredPoisonDamage, 'filtered enemy poison damage'))
      const cappedPoisonDamage = playerPoisonHealthDamage(
        progression.currentHealth, filteredPoisonContactDamage,
      )
      const healthDamage = Math.max(0, finiteModMutation(filteredHealthDamage, 'filtered enemy damage'))
        + cappedPoisonDamage
      const rejectedContact = resistedDamage + poisonContactDamage > 0
        && filteredHealthDamage <= 0 && filteredPoisonContactDamage === 0
      return { healthDamage, rejectedContact, cappedPoisonDamage, filteredHealthDamage, poisonContactDamage }
    }

    function applyStatusModifiers() {
      if (!rejectedContact && (shieldActive || !stoneskin || poisonContactDamage > 0)) {
        const poisonDamage = progression.poisonImmunityTicksRemaining > 0 ? 0 : damage.poisonDamage
        appliedPlayerDamage.push({
          ...damage,
          poisonDamage,
          poisonDuration: playerPoisonDurationSeconds(derived, damage.poisonDuration),
        })
        let active = admittedStatusKinds.get(damage.playerId)
        if (active === undefined) {
          active = new Set<'cold' | 'poison'>()
          if (progression.coldSlowTicksRemaining > 0) active.add('cold')
          if (progression.poisonTicksRemaining > 0) active.add('poison')
          admittedStatusKinds.set(damage.playerId, active)
        }
        for (const status of ['cold', 'poison'] as const) {
          if (active.has(status) || (status === 'cold' ? damage.coldSlowTicks <= 0 : poisonDamage <= 0)) continue
          active.add(status)
          const burst = emitPlayerStatusBurst(world.enemies, {
            actorId: damage.actorId,
            playerId: damage.playerId,
            position: character.position,
            status,
            tick,
          }, secondaryAbilities.rng)
          world = { ...world, enemies: burst.store }
          secondaryAbilities = { ...secondaryAbilities, rng: burst.rng }
          playerDamageSoundEvents.push(burst.event)
        }
      }
    }

    function playHurtResponse() {
      const narration = world.tutorial?.narration
      const dialogueIdle = world.encounter?.phase !== 'speaking'
        && (narration === undefined || (narration.current === null && narration.pending.length === 0))
      if (
        after.currentHealth < before.currentHealth
        && after.lifeState === 'alive'
        && cappedPoisonDamage === 0
        && filteredHealthDamage > 0
        && dialogueIdle
        && nativeWizardOuchCooldownReady(tick, world.playerOuchDeadlineTick)
      ) {
        const emitted = emitBoneyardPlayerDamageSound(world.enemies, {
          actorId: damage.actorId,
          currentHealth: after.currentHealth,
          playerId: damage.playerId,
          position: character.position,
          tick,
        }, secondaryAbilities.rng)
        secondaryAbilities = { ...secondaryAbilities, rng: emitted.rng }
        playerDamageSoundEvents.push(emitted.event)
        world = {
          ...world,
          enemies: emitted.store,
          playerOuchDeadlineTick: emitted.deadlineTick,
        }
      }
    }

    function applyFlashResponse() {
      if (
        !rejectedContact
        && after.lifeState === 'alive'
        && cappedPoisonDamage === 0
        && !damage.suppressFlash
        && (intercepted.absorbedDamage === 0 || poisonContactDamage > 0)
        && (!stoneskin || poisonContactDamage > 0)
      ) {
        const flashResponse = resolvePlayerFlashResponse(derived, secondaryAbilities.rng)
        secondaryAbilities = { ...secondaryAbilities, rng: flashResponse.rng }
        if (flashResponse.flash !== null) {
          const worldKey = gameWorldKey(world, damage.playerId)
          const targetIds = boneyardNativeSecondaryTargets(
                world.enemies,
                character.position,
                NATIVE_FLASH_RESPONSE_RADIUS,
              ).map(({ id }) => id)
          secondaryAbilities = materializeNativePlayerFlashResponse(
            secondaryAbilities,
            {
              ownerId: damage.playerId,
              position: character.position,
              response: flashResponse.flash,
              targetIds,
              tick,
              worldKey,
            },
          )
        }
      }
    }
  }
}

export function gameWorldKey(world: GameWorldState, playerId: string): string {
  return world.kind === 'hub'
    ? `hub:${world.participants[playerId]!.region}`
    : `boneyard:${world.runId}`
}

export function finiteModMutation(value: number, field: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) {
    throw new RangeError(`${field} must be finite and within +/-1000000`)
  }
  return value
}

function squaredVectorDistance(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function playerContactSource(world: BoneyardWorldState, actorId: number) {
  return world.enemies.actors.find(actor => actor.id === actorId)
    ?? world.enemies.maggots.find(actor => actor.id === actorId)
}
