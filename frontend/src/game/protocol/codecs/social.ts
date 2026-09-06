import { isWizardDiscipline, isWizardElement } from '../../core-kernels/player-character.ts'
import { PLAYER_LIFE_STATES, type PlayerLifeState } from '../../core-kernels/player-combat.ts'
import {
  type GameChatChannel,
  type GameChatRejectionReason,
  type GameChatSender,
  type GameCollegeInvitation,
  type GameOnlinePreferences,
  type GamePlayerCardProfile,
  normalizeGameChatText,
} from '../game-chat.ts'
import type { GameSessionKind } from '../game-protocol-contract.ts'
import { MAX_GAME_COLLEGE_INVITATIONS } from '../game-protocol-limits.ts'
import {
  type LocalPartyState,
  PARTY_VISIBILITIES,
  type PartyJoinRequester,
  type PartyPlayerProfile,
  type PartyRosterPlayer,
  type PartyVisibility,
  type PlayerSocialProfile,
} from '../party-state.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  integerWithin,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeInteger,
  onlyKeys,
  playerReference,
  positiveFinite,
  record,
  validatedPlayerId,
} from './values.ts'

export function partyIdentifier(value: unknown, field: string): string {
  const result = limitedString(value, field, 64)
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new GameProtocolError(`${field} must contain only identifier characters`)
  }
  return result
}

function partyJoinCode(value: unknown, field: string): string {
  const result = limitedString(value, field, 9)
  if (!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(result)) {
    throw new GameProtocolError(`${field} must be a formatted Party ID`)
  }
  return result
}

export function partyVisibility(value: unknown, field: string): PartyVisibility {
  return memberString(value, field, PARTY_VISIBILITIES)
}

export function gameSessionKind(value: unknown): GameSessionKind {
  return memberString(
    value,
    'sessionKind',
    ['global-hub', 'private-college', 'standalone'] as const,
  )
}

function partyPlayerProfile(value: unknown, field: string): PartyPlayerProfile {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accountUsername',
    'displayName',
    'highestWave',
    'playerId',
    'totalPlaytimeMs',
  ])
  return {
    ...playerSocialProfile(
      {
        accountUsername: source.accountUsername,
        highestWave: source.highestWave,
        totalPlaytimeMs: source.totalPlaytimeMs,
      },
      field,
    ),
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
  }
}

function partyRosterPlayer(value: unknown, field: string): PartyRosterPlayer {
  const source = record(value, field)
  onlyKeys(source, field, [
    'connected',
    'currentHealth',
    'displayName',
    'element',
    'lifeState',
    'maximumHealth',
    'playerId',
  ])
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  const lifeState = limitedString(source.lifeState, `${field}.lifeState`, 32)
  if (!(PLAYER_LIFE_STATES as readonly string[]).includes(lifeState)) {
    throw new GameProtocolError(`${field}.lifeState is not supported`)
  }
  return {
    connected: boolean(source.connected, `${field}.connected`),
    currentHealth: finite(source.currentHealth, `${field}.currentHealth`),
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
    lifeState: lifeState as PlayerLifeState,
    maximumHealth: positiveFinite(source.maximumHealth, `${field}.maximumHealth`),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
  }
}

export function playerSocialProfile(value: unknown, field: string): PlayerSocialProfile {
  const source = record(value, field)
  onlyKeys(source, field, ['accountUsername', 'highestWave', 'totalPlaytimeMs'])
  return {
    accountUsername: source.accountUsername === null
      ? null
      : limitedString(source.accountUsername, `${field}.accountUsername`, 64),
    highestWave: source.highestWave === null
      ? null
      : integerWithin(source.highestWave, `${field}.highestWave`, 1, 1_000_000),
    totalPlaytimeMs: source.totalPlaytimeMs === null
      ? null
      : integerWithin(source.totalPlaytimeMs, `${field}.totalPlaytimeMs`, 0, 10_000_000_000_000),
  }
}

export function gameChatChannel(value: unknown, field: string): GameChatChannel {
  return memberString(value, field, ['boneyard', 'global', 'party', 'whisper'] as const)
}

export function gameOnlinePreferences(value: unknown, field: string): GameOnlinePreferences {
  const source = record(value, field)
  onlyKeys(source, field, ['activityMessages', 'globalChat', 'submitRuns'])
  const globalChat = boolean(source.globalChat, `${field}.globalChat`)
  const activityMessages = boolean(source.activityMessages, `${field}.activityMessages`)
  if (activityMessages && !globalChat) {
    throw new GameProtocolError(`${field}.activityMessages requires globalChat`)
  }
  return {
    activityMessages,
    globalChat,
    submitRuns: boolean(source.submitRuns, `${field}.submitRuns`),
  }
}

export function gameChatText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new GameProtocolError(`${field} must be a string`)
  let result: string
  try {
    result = normalizeGameChatText(value)
  } catch (error) {
    throw new GameProtocolError(error instanceof Error ? error.message : `${field} is invalid`)
  }
  if (result !== value) {
    throw new GameProtocolError(`${field} must not begin or end with whitespace`)
  }
  return result
}

export function gameChatSender(value: unknown, field: string): GameChatSender {
  const source = record(value, field)
  onlyKeys(source, field, ['displayName', 'playerId', 'playerReference'])
  return {
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
    playerReference: playerReference(
      source.playerReference,
      `${field}.playerReference`,
    ),
  }
}

export function gamePlayerCardProfile(value: unknown, field: string): GamePlayerCardProfile {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accountUsername',
    'activity',
    'discipline',
    'displayName',
    'element',
    'gold',
    'highestWave',
    'playerReference',
    'sessionKind',
    'totalPlaytimeMs',
  ])
  const discipline = limitedString(source.discipline, `${field}.discipline`, 32)
  if (!isWizardDiscipline(discipline)) {
    throw new GameProtocolError(`${field}.discipline is not supported`)
  }
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  return {
    accountUsername: source.accountUsername === null
      ? null
      : limitedString(source.accountUsername, `${field}.accountUsername`, 64),
    activity: memberString(
      source.activity,
      `${field}.activity`,
      ['boneyard', 'hub'] as const,
    ),
    discipline,
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
    gold: nonnegativeInteger(source.gold, `${field}.gold`),
    highestWave: source.highestWave === null
      ? null
      : integerWithin(source.highestWave, `${field}.highestWave`, 1, 1_000_000),
    playerReference: playerReference(
      source.playerReference,
      `${field}.playerReference`,
    ),
    sessionKind: memberString(
      source.sessionKind,
      `${field}.sessionKind`,
      ['global-hub', 'private-college', 'standalone'] as const,
    ),
    totalPlaytimeMs: source.totalPlaytimeMs === null
      ? null
      : integerWithin(
          source.totalPlaytimeMs,
          `${field}.totalPlaytimeMs`,
          0,
          10_000_000_000_000,
        ),
  }
}

export function gameCollegeInvitations(value: unknown): readonly GameCollegeInvitation[] {
  const invitations = limitedArray(
    value,
    'invitations',
    MAX_GAME_COLLEGE_INVITATIONS,
  ).map((entry, index) => gameCollegeInvitation(entry, `invitations[${index}]`))
  if (new Set(invitations.map(({ id }) => id)).size !== invitations.length) {
    throw new GameProtocolError('invitations contains a duplicate id')
  }
  return invitations
}

function gameCollegeInvitation(value: unknown, field: string): GameCollegeInvitation {
  const source = record(value, field)
  onlyKeys(source, field, ['expiresAtUnixMs', 'id', 'inviter', 'joinCode'])
  return {
    expiresAtUnixMs: integerWithin(
      source.expiresAtUnixMs,
      `${field}.expiresAtUnixMs`,
      1,
      10_000_000_000_000,
    ),
    id: partyIdentifier(source.id, `${field}.id`),
    inviter: gameChatSender(source.inviter, `${field}.inviter`),
    joinCode: partyJoinCode(source.joinCode, `${field}.joinCode`),
  }
}

export function gameChatRejectionReason(value: unknown): GameChatRejectionReason {
  return memberString(
    value,
    'reason',
    ['channel-unavailable', 'rate-limited', 'target-unavailable'] as const,
  )
}

export function localPartyState(value: unknown): LocalPartyState {
  const source = record(value, 'state')
  onlyKeys(source, 'state', [
    'hubPlayers', 'invitations', 'joinRequests', 'party', 'partyRoster', 'revision',
  ])
  const hubPlayers = limitedArray(source.hubPlayers, 'state.hubPlayers', 64)
    .map((entry, index) => partyPlayerProfile(entry, `state.hubPlayers[${index}]`))
  const hubPlayerIds = new Set(hubPlayers.map(({ playerId }) => playerId))
  if (hubPlayerIds.size !== hubPlayers.length) {
    throw new GameProtocolError('state.hubPlayers contains a duplicate player id')
  }
  const party = record(source.party, 'state.party')
  onlyKeys(party, 'state.party', [
    'id',
    'joinCode',
    'leaderPlayerId',
    'listingId',
    'memberPlayerIds',
    'visibility',
  ])
  const memberPlayerIds = limitedArray(
    party.memberPlayerIds,
    'state.party.memberPlayerIds',
    64,
  ).map((entry, index) => validatedPlayerId(
    entry,
    `state.party.memberPlayerIds[${index}]`,
  ))
  if (memberPlayerIds.length === 0) {
    throw new GameProtocolError('state.party.memberPlayerIds must not be empty')
  }
  if (new Set(memberPlayerIds).size !== memberPlayerIds.length) {
    throw new GameProtocolError('state.party.memberPlayerIds contains a duplicate player id')
  }
  const leaderPlayerId = validatedPlayerId(
    party.leaderPlayerId,
    'state.party.leaderPlayerId',
  )
  if (!memberPlayerIds.includes(leaderPlayerId)) {
    throw new GameProtocolError('state.party leader is not a party member')
  }
  const partyRoster = limitedArray(source.partyRoster, 'state.partyRoster', 64)
    .map((entry, index) => partyRosterPlayer(entry, `state.partyRoster[${index}]`))
  const partyRosterIds = partyRoster.map(({ playerId }) => playerId)
  if (new Set(partyRosterIds).size !== partyRosterIds.length) {
    throw new GameProtocolError('state.partyRoster contains a duplicate player id')
  }
  if (
    partyRosterIds.length !== memberPlayerIds.length
    || partyRosterIds.some((id, index) => id !== memberPlayerIds[index])
  ) throw new GameProtocolError('state.partyRoster must match party member order')
  const invitations = limitedArray(source.invitations, 'state.invitations', 64)
    .map((entry, index) => {
      const field = `state.invitations[${index}]`
      const invitation = record(entry, field)
      onlyKeys(invitation, field, ['id', 'inviter', 'partyId'])
      const inviter = partyPlayerProfile(invitation.inviter, `${field}.inviter`)
      if (!hubPlayerIds.has(inviter.playerId)) {
        throw new GameProtocolError(`${field}.inviter is not a Hub player`)
      }
      return {
        id: partyIdentifier(invitation.id, `${field}.id`),
        inviter,
        partyId: partyIdentifier(invitation.partyId, `${field}.partyId`),
      }
    })
  if (new Set(invitations.map(({ id }) => id)).size !== invitations.length) {
    throw new GameProtocolError('state.invitations contains a duplicate invitation id')
  }
  const joinRequests = limitedArray(source.joinRequests, 'state.joinRequests', 16)
    .map((entry, index) => {
      const field = `state.joinRequests[${index}]`
      const request = record(entry, field)
      onlyKeys(request, field, ['id', 'requester'])
      const requesterSource = record(request.requester, `${field}.requester`)
      onlyKeys(requesterSource, `${field}.requester`, [
        'accountUsername',
        'displayName',
        'requesterId',
      ])
      const requester: PartyJoinRequester = {
        accountUsername: requesterSource.accountUsername === null
          ? null
          : limitedString(
              requesterSource.accountUsername,
              `${field}.requester.accountUsername`,
              64,
            ),
        displayName: limitedString(
          requesterSource.displayName,
          `${field}.requester.displayName`,
          64,
        ),
        requesterId: partyIdentifier(
          requesterSource.requesterId,
          `${field}.requester.requesterId`,
        ),
      }
      return {
        id: partyIdentifier(request.id, `${field}.id`),
        requester,
      }
    })
  if (new Set(joinRequests.map(({ id }) => id)).size !== joinRequests.length) {
    throw new GameProtocolError('state.joinRequests contains a duplicate request id')
  }
  return {
    hubPlayers,
    invitations,
    joinRequests,
    party: {
      id: partyIdentifier(party.id, 'state.party.id'),
      joinCode: partyJoinCode(party.joinCode, 'state.party.joinCode'),
      leaderPlayerId,
      listingId: partyIdentifier(party.listingId, 'state.party.listingId'),
      memberPlayerIds,
      visibility: partyVisibility(party.visibility, 'state.party.visibility'),
    },
    partyRoster,
    revision: nonnegativeInteger(source.revision, 'state.revision'),
  }
}
