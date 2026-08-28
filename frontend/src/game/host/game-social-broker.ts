import { randomBytes } from 'node:crypto'

import {
  gameChatActivityText,
  type GameChatActivity,
  type GameChatSender,
  type GameCollegeInvitation,
  type GameOnlinePreferences,
  type GamePlayerCardProfile,
} from '../protocol/game-chat.ts'

export const GAME_SOCIAL_INVITATION_TIMEOUT_MS = 10 * 60 * 1000
export const GAME_SOCIAL_MAX_INVITATIONS_PER_PLAYER = 8

export interface GameSocialChatDelivery {
  readonly activity?: GameChatActivity
  readonly channel: 'global' | 'whisper'
  readonly deliveryId: number
  readonly recipient?: GameChatSender
  readonly sender: GameChatSender
  readonly text: string
}

export interface GameSocialParticipant {
  readonly hostId: string
  readonly localPlayerId: string
  canReceiveCollegeInvitation(): boolean
  deliverChat(message: GameSocialChatDelivery): void
  deliverCollegeInvitations(invitations: readonly GameCollegeInvitation[]): void
  profile(): GamePlayerCardProfile | null
}

export type GameSocialCollegeInviteRejection =
  | 'already-invited'
  | 'not-in-hub'
  | 'player-missing'
  | 'self-invite'

export interface GameSocialConnection {
  readonly playerReference: string
  activate(): void
  close(): void
  dismissCollegeInvitation(invitationId: string): void
  inviteToCollege(
    targetPlayerReference: string,
    sourcePartyId: string,
    joinCode: string,
  ): GameSocialCollegeInviteRejection | null
  publishActivity(activity: GameChatActivity): void
  publishGlobal(text: string): boolean
  publishWhisper(targetPlayerReference: string, text: string): boolean
  refreshCollegeInvitationAvailability(): void
  resolvePlayerCard(playerReference: string): GamePlayerCardProfile | null
  revokeCollegeInvitations(sourcePartyId: string): void
  setOnlinePreferences(preferences: GameOnlinePreferences): void
}

export interface GameSocialBroker {
  close(): void
  prune(nowUnixMs?: number): void
  register(
    participant: GameSocialParticipant,
    preferences: GameOnlinePreferences,
    playerReference?: string,
  ): GameSocialConnection
}

interface BrokerMember {
  active: boolean
  readonly participant: GameSocialParticipant
  readonly playerReference: string
  preferences: GameOnlinePreferences
}

interface BrokerInvitation {
  readonly invitation: GameCollegeInvitation
  readonly sourcePartyId: string
  readonly sourcePlayerReference: string
  readonly targetPlayerReference: string
}

export function startGameSocialBroker(): GameSocialBroker {
  const members = new Map<string, BrokerMember>()
  const invitations = new Map<string, BrokerInvitation>()
  let closed = false
  let nextChatDeliveryId = 1

  const broker: GameSocialBroker = {
    close() {
      if (closed) return
      closed = true
      members.clear()
      invitations.clear()
    },
    prune(nowUnixMs = Date.now()) {
      if (closed) return
      const affected = new Set<string>()
      for (const [id, pending] of invitations) {
        if (pending.invitation.expiresAtUnixMs > nowUnixMs) continue
        invitations.delete(id)
        affected.add(pending.targetPlayerReference)
      }
      for (const playerReference of affected) deliverInvitations(playerReference)
    },
    register(participant, preferences, requestedReference) {
      if (closed) throw new Error('The game social broker is closed')
      const playerReference = requestedReference ?? createPlayerReference()
      if (!isPlayerReference(playerReference)) {
        throw new Error('The game social participant reference is invalid')
      }
      const existing = members.get(playerReference)
      if (existing && (
        existing.participant.hostId !== participant.hostId
        || existing.participant.localPlayerId !== participant.localPlayerId
      )) {
        throw new Error('The game social participant reference is already owned')
      }
      const member: BrokerMember = {
        active: false,
        participant,
        playerReference,
        preferences: { ...preferences },
      }
      members.set(playerReference, member)
      let connectionClosed = false
      const currentMember = (): BrokerMember | null => (
        !connectionClosed && members.get(playerReference) === member ? member : null
      )
      return {
        playerReference,
        activate() {
          const current = currentMember()
          if (!current || current.active) return
          current.active = true
          deliverInvitations(playerReference)
        },
        close() {
          if (connectionClosed) return
          connectionClosed = true
          if (members.get(playerReference) !== member) return
          members.delete(playerReference)
          removeInvitations(candidate => (
            candidate.targetPlayerReference === playerReference
            || candidate.sourcePlayerReference === playerReference
          ))
        },
        dismissCollegeInvitation(invitationId) {
          const current = currentMember()
          const pending = invitations.get(invitationId)
          if (!current || pending?.targetPlayerReference !== playerReference) return
          invitations.delete(invitationId)
          deliverInvitations(playerReference)
        },
        inviteToCollege(targetPlayerReference, sourcePartyId, joinCode) {
          const source = currentMember()
          if (!source || !source.active || !source.preferences.globalChat) {
            return 'player-missing'
          }
          if (targetPlayerReference === playerReference) return 'self-invite'
          const target = availableMember(targetPlayerReference)
          if (!target) return 'player-missing'
          if (!target.participant.canReceiveCollegeInvitation()) return 'not-in-hub'
          broker.prune()
          const existing = [...invitations.values()].find(candidate => (
            candidate.sourcePartyId === sourcePartyId
            && candidate.targetPlayerReference === targetPlayerReference
          ))
          if (existing) return 'already-invited'
          const targetInvitations = invitationsFor(targetPlayerReference)
          if (targetInvitations.length >= GAME_SOCIAL_MAX_INVITATIONS_PER_PLAYER) {
            return 'already-invited'
          }
          const identity = identityFor(source, target.participant.hostId)
          const invitation: GameCollegeInvitation = {
            expiresAtUnixMs: Date.now() + GAME_SOCIAL_INVITATION_TIMEOUT_MS,
            id: `college-invite-${randomBytes(18).toString('base64url')}`,
            inviter: identity,
            joinCode,
          }
          invitations.set(invitation.id, {
            invitation,
            sourcePartyId,
            sourcePlayerReference: playerReference,
            targetPlayerReference,
          })
          deliverInvitations(targetPlayerReference)
          return null
        },
        publishActivity(activity) {
          const sender = currentMember()
          if (
            !sender
            || !sender.active
            || !sender.preferences.activityMessages
            || !sender.preferences.globalChat
          ) return
          const deliveryId = consumeChatDeliveryId()
          for (const recipient of members.values()) {
            if (
              recipient === sender
              || !recipient.active
              || !recipient.preferences.activityMessages
              || !recipient.preferences.globalChat
            ) continue
            recipient.participant.deliverChat({
              activity,
              channel: 'global',
              deliveryId,
              sender: identityFor(sender, recipient.participant.hostId),
              text: gameChatActivityText(activity, sender.participant.profile()?.displayName
                ?? identityFor(sender, recipient.participant.hostId).displayName),
            })
          }
        },
        publishGlobal(text) {
          const sender = currentMember()
          if (!sender || !sender.active || !sender.preferences.globalChat) return false
          const deliveryId = consumeChatDeliveryId()
          for (const recipient of members.values()) {
            if (!recipient.active || !recipient.preferences.globalChat) continue
            recipient.participant.deliverChat({
              channel: 'global',
              deliveryId,
              sender: identityFor(sender, recipient.participant.hostId),
              text,
            })
          }
          return true
        },
        publishWhisper(targetPlayerReference, text) {
          const sender = currentMember()
          const target = availableMember(targetPlayerReference)
          if (
            !sender
            || !sender.active
            || !sender.preferences.globalChat
            || !target
            || target === sender
          ) return false
          const pair = [sender, target] as const
          const deliveryId = consumeChatDeliveryId()
          for (const recipient of pair) {
            recipient.participant.deliverChat({
              channel: 'whisper',
              deliveryId,
              recipient: identityFor(target, recipient.participant.hostId),
              sender: identityFor(sender, recipient.participant.hostId),
              text,
            })
          }
          return true
        },
        refreshCollegeInvitationAvailability() {
          const current = currentMember()
          if (!current) return
          if (!current.participant.canReceiveCollegeInvitation()) {
            removeInvitations(candidate => (
              candidate.targetPlayerReference === playerReference
            ))
          } else {
            deliverInvitations(playerReference)
          }
        },
        resolvePlayerCard(targetPlayerReference) {
          const requester = currentMember()
          const target = availableMember(targetPlayerReference)
          if (!requester || !requester.active || !requester.preferences.globalChat || !target) {
            return null
          }
          const profile = target.participant.profile()
          return profile?.playerReference === targetPlayerReference ? profile : null
        },
        revokeCollegeInvitations(sourcePartyId) {
          if (!currentMember()) return
          removeInvitations(candidate => candidate.sourcePartyId === sourcePartyId)
        },
        setOnlinePreferences(preferences) {
          const current = currentMember()
          if (!current) return
          const wasAvailable = current.preferences.globalChat
          current.preferences = { ...preferences }
          if (wasAvailable && !current.preferences.globalChat) {
            removeInvitations(candidate => (
              candidate.targetPlayerReference === playerReference
              || candidate.sourcePlayerReference === playerReference
            ))
          } else if (!wasAvailable && current.preferences.globalChat) {
            deliverInvitations(playerReference)
          }
        },
      }
    },
  }

  function availableMember(playerReference: string): BrokerMember | null {
    const member = members.get(playerReference)
    return member?.active && member.preferences.globalChat ? member : null
  }

  function consumeChatDeliveryId(): number {
    const deliveryId = nextChatDeliveryId
    nextChatDeliveryId = nextChatDeliveryId === Number.MAX_SAFE_INTEGER
      ? 1
      : nextChatDeliveryId + 1
    return deliveryId
  }

  function identityFor(member: BrokerMember, recipientHostId: string): GameChatSender {
    const profile = member.participant.profile()
    return {
      displayName: profile?.displayName ?? member.participant.localPlayerId,
      playerId: member.participant.hostId === recipientHostId
        ? member.participant.localPlayerId
        : member.playerReference,
      playerReference: member.playerReference,
    }
  }

  function invitationsFor(playerReference: string): readonly GameCollegeInvitation[] {
    return [...invitations.values()]
      .filter(candidate => candidate.targetPlayerReference === playerReference)
      .map(({ invitation }) => invitation)
      .sort((left, right) => left.expiresAtUnixMs - right.expiresAtUnixMs)
  }

  function deliverInvitations(playerReference: string): void {
    const member = members.get(playerReference)
    if (!member?.active) return
    member.participant.deliverCollegeInvitations(
      member.preferences.globalChat ? invitationsFor(playerReference) : [],
    )
  }

  function removeInvitations(predicate: (invitation: BrokerInvitation) => boolean): void {
    const affected = new Set<string>()
    for (const [id, invitation] of invitations) {
      if (!predicate(invitation)) continue
      invitations.delete(id)
      affected.add(invitation.targetPlayerReference)
    }
    for (const playerReference of affected) deliverInvitations(playerReference)
  }

  return broker
}

function createPlayerReference(): string {
  return `player-ref-${randomBytes(24).toString('base64url')}`
}

function isPlayerReference(value: string): boolean {
  return /^player-ref-[A-Za-z0-9_-]{32}$/.test(value)
}
