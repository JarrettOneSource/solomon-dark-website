import {
  type PlayerCharacterConfig,
  type PlayerPrimaryCastState,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  coldSlowPlayer,
  dazzlePlayer,
  damagePlayer,
  playerCanAcceptInput,
  playerCanCast,
  playerDisplayHealth,
  poisonPlayer,
  playerMovementScale,
  resetPlayerCombatForNewRun,
  setPlayerSpectating,
  stepPlayerCombatTick,
  tryDebitPlayerMana,
} from '../core-kernels/player-combat.ts'
import {
  applyPlayerSkillChoice,
  createPlayerProgression,
  createPlayerSkillBook,
  grantPlayerExperience,
  playerStatBook,
  synchronizePlayerLevelMilestone,
  type PlayerProgressionComponent,
  type SharedPlayerLevelMilestone,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'

export type PlayerEntityId = number

export interface PlayerIdentityComponent {
  readonly playerId: string
}

export type PlayerLocomotionComponent = Omit<PlayerCharacterState, 'config' | 'primaryCast'>

export interface PlayerEntityStore {
  readonly configs: readonly PlayerCharacterConfig[]
  readonly entityIds: readonly PlayerEntityId[]
  readonly identities: readonly PlayerIdentityComponent[]
  readonly locomotions: readonly PlayerLocomotionComponent[]
  readonly nextEntityId: PlayerEntityId
  readonly primaryCasts: readonly PlayerPrimaryCastState[]
  readonly progressions: readonly PlayerProgressionComponent[]
  readonly skillBooks: readonly PlayerSkillBookComponent[]
  readonly statBooks: readonly PlayerStatBookComponent[]
}

export interface PlayerEntityCombatTickResult {
  readonly beganDeathEpochPlayerIds: readonly string[]
  readonly deathBurstPlayerIds: readonly string[]
  readonly store: PlayerEntityStore
}

export interface PlayerEntityManaDebitResult {
  readonly accepted: boolean
  readonly store: PlayerEntityStore
}

export interface PlayerEntitySharedExperienceResult {
  readonly milestone: SharedPlayerLevelMilestone | null
  readonly store: PlayerEntityStore
}

export function createPlayerEntityStore(): PlayerEntityStore {
  return {
    configs: [],
    entityIds: [],
    identities: [],
    locomotions: [],
    nextEntityId: 1,
    primaryCasts: [],
    progressions: [],
    skillBooks: [],
    statBooks: [],
  }
}

export function addPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  config: PlayerCharacterConfig,
  character: PlayerCharacterState,
  offerSeed: number,
): PlayerEntityStore {
  if (playerEntityIndex(source, playerId) >= 0) return source
  return {
    configs: [...source.configs, Object.freeze({ ...config })],
    entityIds: [...source.entityIds, source.nextEntityId],
    identities: [...source.identities, Object.freeze({ playerId })],
    locomotions: [...source.locomotions, locomotionComponent(character)],
    nextEntityId: source.nextEntityId + 1,
    primaryCasts: [...source.primaryCasts, character.primaryCast],
    progressions: [...source.progressions, createPlayerProgression(offerSeed)],
    skillBooks: [...source.skillBooks, createPlayerSkillBook(config)],
    statBooks: [...source.statBooks, playerStatBook()],
  }
}

export function removePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  return {
    configs: withoutIndex(source.configs, index),
    entityIds: withoutIndex(source.entityIds, index),
    identities: withoutIndex(source.identities, index),
    locomotions: withoutIndex(source.locomotions, index),
    nextEntityId: source.nextEntityId,
    primaryCasts: withoutIndex(source.primaryCasts, index),
    progressions: withoutIndex(source.progressions, index),
    skillBooks: withoutIndex(source.skillBooks, index),
    statBooks: withoutIndex(source.statBooks, index),
  }
}

export function playerEntityIndex(source: PlayerEntityStore, playerId: string): number {
  return source.identities.findIndex((identity) => identity.playerId === playerId)
}

export function playerEntityId(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityId | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.entityIds[index] ?? null
}

export function playerCharacterAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerCharacterState | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : playerCharacterProjection(source, index)
}

export function playerProgressionAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerProgressionComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.progressions[index] ?? null
}

export function playerSkillBookAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerSkillBookComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.skillBooks[index] ?? null
}

export function playerStatBookAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerStatBookComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.statBooks[index] ?? null
}

export function playerCharacterRecords(
  source: PlayerEntityStore,
): Readonly<Record<string, PlayerCharacterState>> {
  return Object.fromEntries(source.identities.map((identity, index) => [
    identity.playerId,
    playerCharacterProjection(source, index),
  ]))
}

export function replacePlayerCharacterRecords(
  source: PlayerEntityStore,
  players: Readonly<Record<string, PlayerCharacterState>>,
): PlayerEntityStore {
  const locomotions = source.identities.map((identity, index) => {
    const player = players[identity.playerId]
    return player ? locomotionComponent(player) : source.locomotions[index]!
  })
  const primaryCasts = source.identities.map((identity, index) => (
    players[identity.playerId]?.primaryCast ?? source.primaryCasts[index]!
  ))
  return { ...source, locomotions, primaryCasts }
}

export function replacePlayerCharacter(
  source: PlayerEntityStore,
  playerId: string,
  character: PlayerCharacterState,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const locomotions = [...source.locomotions]
  const primaryCasts = [...source.primaryCasts]
  locomotions[index] = locomotionComponent(character)
  primaryCasts[index] = character.primaryCast
  return { ...source, locomotions, primaryCasts }
}

export function damagePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  damage: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = damagePlayer(source.progressions[index]!, damage)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function poisonPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  damagePerSecond: number,
  durationSeconds: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = poisonPlayer(
    source.progressions[index]!,
    damagePerSecond,
    durationSeconds,
  )
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function coldSlowPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  durationTicks: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = coldSlowPlayer(source.progressions[index]!, durationTicks)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function dazzlePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  durationTicks: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = dazzlePlayer(source.progressions[index]!, durationTicks)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function tryDebitPlayerEntityMana(
  source: PlayerEntityStore,
  playerId: string,
  cost: number,
): PlayerEntityManaDebitResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { accepted: false, store: source }
  const debit = tryDebitPlayerMana(source.progressions[index]!, cost)
  return {
    accepted: debit.accepted,
    store: debit.combat === source.progressions[index]
      ? source
      : replacePlayerProgression(source, index, debit.combat),
  }
}

export function stepPlayerEntityCombatTick(
  source: PlayerEntityStore,
): PlayerEntityCombatTickResult {
  const beganDeathEpochPlayerIds: string[] = []
  const deathBurstPlayerIds: string[] = []
  let changed = false
  const progressions = source.progressions.map((progression, index) => {
    const result = stepPlayerCombatTick(progression)
    const playerId = source.identities[index]!.playerId
    if (result.beganDeathEpoch) beganDeathEpochPlayerIds.push(playerId)
    if (result.emittedDeathBurst) deathBurstPlayerIds.push(playerId)
    changed ||= result.combat !== progression
    return result.combat
  })
  return {
    beganDeathEpochPlayerIds: Object.freeze(beganDeathEpochPlayerIds),
    deathBurstPlayerIds: Object.freeze(deathBurstPlayerIds),
    store: changed ? { ...source, progressions } : source,
  }
}

export function setPlayerEntitySpectating(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = setPlayerSpectating(source.progressions[index]!)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function playerEntityCanAcceptInput(
  source: PlayerEntityStore,
  playerId: string,
): boolean {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerCanAcceptInput(progression) : false
}

export function playerEntityCanCast(
  source: PlayerEntityStore,
  playerId: string,
): boolean {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerCanCast(progression) : false
}

export function playerEntityDisplayHealth(
  source: PlayerEntityStore,
  playerId: string,
): number | null {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerDisplayHealth(progression) : null
}

export function playerEntityMovementScale(
  source: PlayerEntityStore,
  playerId: string,
): number {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerMovementScale(progression) : 1
}

export function resetPlayerEntitiesForNewRun(
  source: PlayerEntityStore,
  placements: Readonly<Record<string, PlayerCharacterState>>,
): PlayerEntityStore {
  const placementIds = Object.keys(placements)
  if (
    placementIds.length !== source.identities.length
    || source.identities.some(({ playerId }) => !Object.hasOwn(placements, playerId))
  ) {
    throw new Error('new run requires exactly one placement for every player entity')
  }
  return {
    ...source,
    locomotions: source.identities.map(({ playerId }) => (
      locomotionComponent(placements[playerId]!)
    )),
    primaryCasts: source.identities.map(({ playerId }) => placements[playerId]!.primaryCast),
    progressions: source.progressions.map(resetPlayerCombatForNewRun),
  }
}

export function grantPlayerEntityExperience(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) throw new Error(`player entity store has no player ${playerId}`)
  const progressions = [...source.progressions]
  progressions[index] = grantPlayerExperience(
    progressions[index]!,
    source.skillBooks[index]!,
    amount,
  )
  return { ...source, progressions }
}

export function grantSharedPlayerEntityExperience(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
  participantIds: readonly string[],
): PlayerEntitySharedExperienceResult {
  const sourceIndex = playerEntityIndex(source, playerId)
  if (sourceIndex < 0) throw new Error(`player entity store has no player ${playerId}`)
  const stableParticipantIds = [...new Set(participantIds)].sort()
  if (!stableParticipantIds.includes(playerId)) {
    throw new Error('shared experience source must belong to the participant cohort')
  }
  for (const participantId of stableParticipantIds) {
    if (playerEntityIndex(source, participantId) < 0) {
      throw new Error(`shared experience cohort has no player ${participantId}`)
    }
  }
  const previous = source.progressions[sourceIndex]!
  const awarded = grantPlayerExperience(previous, source.skillBooks[sourceIndex]!, amount)
  const progressions = [...source.progressions]
  progressions[sourceIndex] = awarded
  if (awarded.level === previous.level) {
    return { milestone: null, store: { ...source, progressions } }
  }
  const crossedLevels = Object.freeze(Array.from(
    { length: awarded.level - previous.level },
    (_, index) => previous.level + index + 1,
  ))
  const milestone: SharedPlayerLevelMilestone = Object.freeze({
    crossedLevels,
    experience: awarded.experience,
    level: awarded.level,
  })
  for (const participantId of stableParticipantIds) {
    const index = playerEntityIndex(source, participantId)
    if (index === sourceIndex) continue
    progressions[index] = synchronizePlayerLevelMilestone(
      source.progressions[index]!,
      source.skillBooks[index]!,
      milestone,
    )
  }
  return { milestone, store: { ...source, progressions } }
}

export function applyPlayerEntitySkillChoice(
  source: PlayerEntityStore,
  playerId: string,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
): PlayerEntityStore | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const applied = applyPlayerSkillChoice(
    source.progressions[index]!,
    source.skillBooks[index]!,
    selection,
  )
  if (!applied) return null
  const progressions = [...source.progressions]
  const skillBooks = [...source.skillBooks]
  progressions[index] = applied.progression
  skillBooks[index] = applied.skillBook
  return { ...source, progressions, skillBooks }
}

function withoutIndex<T>(source: readonly T[], index: number): T[] {
  return [...source.slice(0, index), ...source.slice(index + 1)]
}

function replacePlayerProgression(
  source: PlayerEntityStore,
  index: number,
  progression: PlayerProgressionComponent,
): PlayerEntityStore {
  const progressions = [...source.progressions]
  progressions[index] = progression
  return { ...source, progressions }
}

function locomotionComponent(character: PlayerCharacterState): PlayerLocomotionComponent {
  return {
    footstepTick: character.footstepTick,
    gaitDegrees: character.gaitDegrees,
    headingIndex: character.headingIndex,
    position: character.position,
    velocity: character.velocity,
    walkCyclePrimary: character.walkCyclePrimary,
  }
}

function playerCharacterProjection(
  source: PlayerEntityStore,
  index: number,
): PlayerCharacterState {
  return {
    config: source.configs[index]!,
    ...source.locomotions[index]!,
    primaryCast: source.primaryCasts[index]!,
  }
}
