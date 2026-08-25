import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

import type { GameSessionKind } from '../protocol/game-protocol.ts'
import { isWizardElement, type WizardElement } from '../core-kernels/player-character.ts'
import { PLAYER_LIFE_STATES, type PlayerLifeState } from '../core-kernels/player-combat.ts'
import type { PartyVisibility } from '../protocol/party-state.ts'
import type { GameSaveIntegrity } from '../save/game-save-contract.ts'
import {
  parseGameSaveDocument,
} from '../save/game-save-contract.ts'
import { restoreGameSaveDocument } from '../save/game-save-document.ts'

const CLAIM_PREFIX = 'sdrpr2'
const CLAIM_VERSION = 2
export const MAX_PARTY_RECOVERY_CLAIM_LENGTH = 8_192
const BASE64URL_256 = /^[A-Za-z0-9_-]{43}$/
const SHA256 = /^[a-f0-9]{64}$/
const GIT_REVISION = /^[a-f0-9]{40}$/

export interface PartyRecoveryClaim {
  readonly contentManifestSha256: string
  readonly globalScoreEligible: boolean
  readonly integrity: GameSaveIntegrity
  readonly leaderboardUserId: number | null
  readonly partyMemberCount: number
  readonly partyLeaderPlayerId: string
  readonly partyRoster: readonly PartyRecoveryRosterMember[]
  readonly partyVisibility: PartyVisibility
  readonly playerId: string
  readonly recoveryId: string
  readonly runId: string
  readonly sessionKind: Extract<
    GameSessionKind,
    'global-hub' | 'private-college' | 'standalone'
  >
  readonly targetRevision: string | null
}

export interface PartyRecoveryRosterMember {
  readonly currentHealth: number
  readonly displayName: string
  readonly element: WizardElement
  readonly lifeState: PlayerLifeState
  readonly maximumHealth: number
  readonly playerId: string
}

interface SignedPartyRecoveryClaim extends PartyRecoveryClaim {
  readonly documentSha256: string
  readonly version: 2
}

export function createPartyRecoveryClaim(
  secret: string,
  claim: PartyRecoveryClaim,
  unsignedDocument: string,
): string {
  validateSecret(secret)
  validateClaim(claim)
  const normalized = normalizedRecoveryDocument(unsignedDocument, null)
  if (normalized === null) throw new Error('party recovery document must have a null claim')
  validateDocumentBindings(unsignedDocument, claim, null)
  const payload: SignedPartyRecoveryClaim = {
    ...claim,
    documentSha256: sha256(normalized),
    version: CLAIM_VERSION,
  }
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(payloadPart).digest('base64url')
  const token = `${CLAIM_PREFIX}.${payloadPart}.${signature}`
  if (token.length > MAX_PARTY_RECOVERY_CLAIM_LENGTH) {
    throw new Error('party recovery claim exceeds its size limit')
  }
  return token
}

export function decodePartyRecoveryClaim(
  secret: string,
  token: string,
): PartyRecoveryClaim | null {
  const payload = decodeSignedPartyRecoveryClaim(secret, token)
  return payload === null ? null : publicClaim(payload)
}

export function verifyPartyRecoveryClaim(
  secret: string,
  token: string,
  document: string,
): PartyRecoveryClaim | null {
  const payload = decodeSignedPartyRecoveryClaim(secret, token)
  if (payload === null) return null
  const normalized = normalizedRecoveryDocument(document, token)
  if (normalized === null || !hashesEqual(payload.documentSha256, sha256(normalized))) return null
  const claim = publicClaim(payload)
  try {
    validateDocumentBindings(document, claim, token)
  } catch {
    return null
  }
  return claim
}

export function partyRecoveryClaimToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_PARTY_RECOVERY_CLAIM_LENGTH
    && /^sdrpr2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
}

function decodeSignedPartyRecoveryClaim(
  secret: string,
  token: string,
): SignedPartyRecoveryClaim | null {
  try {
    validateSecret(secret)
    if (!partyRecoveryClaimToken(token)) return null
    const [prefix, payloadPart, signaturePart] = token.split('.')
    if (prefix !== CLAIM_PREFIX || !payloadPart || !signaturePart) return null
    const expected = createHmac('sha256', secret).update(payloadPart).digest()
    const actual = Buffer.from(signaturePart, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const value = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as unknown
    if (!record(value)) return null
    const expectedKeys = [
      'contentManifestSha256',
      'documentSha256',
      'globalScoreEligible',
      'integrity',
      'leaderboardUserId',
      'partyLeaderPlayerId',
      'partyMemberCount',
      'partyRoster',
      'partyVisibility',
      'playerId',
      'recoveryId',
      'runId',
      'sessionKind',
      'targetRevision',
      'version',
    ]
    if (
      Object.keys(value).sort().join('\0') !== expectedKeys.sort().join('\0')
      || value.version !== CLAIM_VERSION
      || typeof value.documentSha256 !== 'string'
      || !SHA256.test(value.documentSha256)
    ) return null
    const claim = {
      contentManifestSha256: value.contentManifestSha256,
      documentSha256: value.documentSha256,
      globalScoreEligible: value.globalScoreEligible,
      integrity: value.integrity,
      leaderboardUserId: value.leaderboardUserId,
      partyLeaderPlayerId: value.partyLeaderPlayerId,
      partyMemberCount: value.partyMemberCount,
      partyRoster: value.partyRoster,
      partyVisibility: value.partyVisibility,
      playerId: value.playerId,
      recoveryId: value.recoveryId,
      runId: value.runId,
      sessionKind: value.sessionKind,
      targetRevision: value.targetRevision,
      version: CLAIM_VERSION,
    } as SignedPartyRecoveryClaim
    validateClaim(claim)
    return claim
  } catch {
    return null
  }
}

function validateClaim(claim: PartyRecoveryClaim): void {
  if (!SHA256.test(claim.contentManifestSha256)) {
    throw new Error('party recovery content digest is invalid')
  }
  if (typeof claim.globalScoreEligible !== 'boolean') {
    throw new Error('party recovery score provenance is invalid')
  }
  if (claim.integrity !== 'global-clean' && claim.integrity !== 'local-only') {
    throw new Error('party recovery integrity is invalid')
  }
  if (
    claim.leaderboardUserId !== null
    && (
      !Number.isSafeInteger(claim.leaderboardUserId)
      || claim.leaderboardUserId < 1
      || claim.leaderboardUserId > 0x7fff_ffff
    )
  ) throw new Error('party recovery leaderboard user is invalid')
  if (!Number.isInteger(claim.partyMemberCount) || claim.partyMemberCount < 1 || claim.partyMemberCount > 16) {
    throw new Error('party recovery member count is invalid')
  }
  if (!boundedIdentity(claim.partyLeaderPlayerId)) {
    throw new Error('party recovery leader is invalid')
  }
  if (!Array.isArray(claim.partyRoster) || claim.partyRoster.length !== claim.partyMemberCount) {
    throw new Error('party recovery roster size is invalid')
  }
  const rosterIds = new Set<string>()
  for (const member of claim.partyRoster) {
    validateRosterMember(member)
    if (rosterIds.has(member.playerId)) throw new Error('party recovery roster contains a duplicate')
    rosterIds.add(member.playerId)
  }
  if (!rosterIds.has(claim.partyLeaderPlayerId) || !rosterIds.has(claim.playerId)) {
    throw new Error('party recovery roster is missing its leader or claimant')
  }
  if (
    claim.partyVisibility !== 'public'
    && claim.partyVisibility !== 'invite-only'
    && claim.partyVisibility !== 'private'
  ) throw new Error('party recovery visibility is invalid')
  if (!boundedIdentity(claim.playerId)) throw new Error('party recovery player id is invalid')
  if (!BASE64URL_256.test(claim.recoveryId)) {
    throw new Error('party recovery recovery id is invalid')
  }
  if (!boundedIdentity(claim.runId)) throw new Error('party recovery run id is invalid')
  if (
    claim.sessionKind !== 'global-hub'
    && claim.sessionKind !== 'private-college'
    && claim.sessionKind !== 'standalone'
  ) throw new Error('party recovery session kind is invalid')
  if (
    claim.targetRevision !== null
    && (typeof claim.targetRevision !== 'string' || !GIT_REVISION.test(claim.targetRevision))
  ) throw new Error('party recovery target revision is invalid')
  if (claim.sessionKind === 'global-hub' && claim.integrity !== 'global-clean') {
    throw new Error('party recovery global session integrity is invalid')
  }
}

function validateRosterMember(member: unknown): asserts member is PartyRecoveryRosterMember {
  if (!record(member)) throw new Error('party recovery roster member is invalid')
  const keys = [
    'currentHealth',
    'displayName',
    'element',
    'lifeState',
    'maximumHealth',
    'playerId',
  ]
  if (Object.keys(member).sort().join('\0') !== keys.join('\0')) {
    throw new Error('party recovery roster member fields are invalid')
  }
  if (!boundedIdentity(member.playerId)) throw new Error('party recovery roster player is invalid')
  if (
    typeof member.displayName !== 'string'
    || member.displayName.length < 1
    || member.displayName.length > 64
  ) throw new Error('party recovery roster name is invalid')
  if (typeof member.element !== 'string' || !isWizardElement(member.element)) {
    throw new Error('party recovery roster element is invalid')
  }
  if (
    typeof member.lifeState !== 'string'
    || !(PLAYER_LIFE_STATES as readonly string[]).includes(member.lifeState)
  ) throw new Error('party recovery roster life state is invalid')
  if (
    typeof member.maximumHealth !== 'number'
    || !Number.isFinite(member.maximumHealth)
    || member.maximumHealth <= 0
    || typeof member.currentHealth !== 'number'
    || !Number.isFinite(member.currentHealth)
  ) throw new Error('party recovery roster health is invalid')
}

function validateDocumentBindings(
  document: string,
  claim: PartyRecoveryClaim,
  token: string | null,
): void {
  const parsed = parseGameSaveDocument(document)
  if (
    parsed.sourceSchemaVersion !== 12
    || parsed.continuation === null
    || parsed.continuation.summary.partyRejoinToken !== token
    || parsed.continuation.summary.playerId !== claim.playerId
    || parsed.continuation.summary.worldKind !== 'boneyard'
    || parsed.continuation.summary.phase !== 'active'
    || !parsed.continuation.summary.activeRun
    || parsed.integrity !== claim.integrity
  ) throw new Error('party recovery document bindings are invalid')
  const restored = restoreGameSaveDocument(document)
  if (
    restored.playerId !== claim.playerId
    || restored.loadedBoneyard?.runId !== claim.runId
    || restored.state.world.kind !== 'boneyard'
    || restored.state.world.runId !== claim.runId
    || restored.state.run.runId !== claim.runId
    || restored.state.run.phase !== 'active'
  ) throw new Error('party recovery run bindings are invalid')
}

function normalizedRecoveryDocument(document: string, expectedToken: string | null): string | null {
  try {
    const value = JSON.parse(document) as unknown
    if (!record(value) || !record(value.continuation)) return null
    const summary = value.continuation.summary
    if (!record(summary) || summary.partyRejoinToken !== expectedToken) return null
    summary.partyRejoinToken = null
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function publicClaim(payload: SignedPartyRecoveryClaim): PartyRecoveryClaim {
  return {
    contentManifestSha256: payload.contentManifestSha256,
    globalScoreEligible: payload.globalScoreEligible,
    integrity: payload.integrity,
    leaderboardUserId: payload.leaderboardUserId,
    partyLeaderPlayerId: payload.partyLeaderPlayerId,
    partyMemberCount: payload.partyMemberCount,
    partyRoster: payload.partyRoster,
    partyVisibility: payload.partyVisibility,
    playerId: payload.playerId,
    recoveryId: payload.recoveryId,
    runId: payload.runId,
    sessionKind: payload.sessionKind,
    targetRevision: payload.targetRevision,
  }
}

function hashesEqual(first: string, second: string): boolean {
  const firstBytes = Buffer.from(first, 'hex')
  const secondBytes = Buffer.from(second, 'hex')
  return firstBytes.length === secondBytes.length && timingSafeEqual(firstBytes, secondBytes)
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function validateSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('party recovery secret must contain at least 32 bytes')
  }
}

function boundedIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
