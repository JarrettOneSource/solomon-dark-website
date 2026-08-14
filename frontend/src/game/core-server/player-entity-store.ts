import {
  type PlayerCharacterConfig,
  type PlayerPrimaryCastState,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  applyPlayerSkillChoice,
  createPlayerProgression,
  createPlayerSkillBook,
  grantPlayerExperience,
  playerStatBook,
  type PlayerProgressionComponent,
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
