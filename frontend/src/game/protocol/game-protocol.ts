import { NATIVE_TUTORIAL_SURFACE_ACTIONS } from '../core-kernels/native-tutorial.ts'
import { isWizardDiscipline, isWizardElement } from '../core-kernels/player-character.ts'
import { isNativeBeltSkill, nativeSkillCategory } from '../core-kernels/player-progression.ts'
import { MAX_WEB_GAME_SAVE_BYTES } from '../save/game-save-contract.ts'
import { hubInventoryAction } from './codecs/economy.ts'
import { hubPlayerActivity } from './codecs/hub.ts'
import {
  decodePlayerCharacterInput,
  gameplayPauseSource,
  gameplayPauseState,
  gameplayResumeGraceState,
  playerCharacterConfig,
  playerCharacterKernelParameters,
} from './codecs/input.ts'
import type { LuaConsoleObject } from './codecs/lua.ts'
import { luaConsoleValue } from './codecs/lua.ts'
import { contentManifest, gameModAssets, modConsumableCatalog, modContentProjection } from './codecs/mod-content.ts'
import { boneyardChoices, loadedBoneyard } from './codecs/scene.ts'
import { gameSnapshot, gameSnapshotFrame } from './codecs/snapshot.ts'
import {
  gameChatChannel,
  gameChatRejectionReason,
  gameChatSender,
  gameChatText,
  gameCollegeInvitations,
  gameOnlinePreferences,
  gamePlayerCardProfile,
  gameSessionKind,
  localPartyState,
  partyIdentifier,
  partyVisibility,
  playerSocialProfile,
} from './codecs/social.ts'
import {
  GameProtocolError,
  boolean,
  boundedString,
  byteLimitedString,
  encodedByteLength,
  finite,
  gitRevision,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  luaRequestId,
  memberString,
  nonnegativeInteger,
  onlyKeys,
  parseObject,
  pingNonce,
  playerReference,
  playerTarget,
  positiveFinite,
  positiveInteger,
  validatedPlayerId,
} from './codecs/values.ts'
import { GAME_CHAT_ACTIVITIES, GAME_CHAT_MAX_TEXT_CODE_UNITS, gameChatActivityText } from './game-chat.ts'
import type { ClientGameMessage, ModAction } from './game-client-messages.ts'
import { MOD_ACTIONS } from './game-client-messages.ts'
import {
  MAX_GAME_LEADERBOARD_RECEIPT_BYTES,
  MAX_LUA_CONSOLE_CODE_LENGTH,
  MAX_LUA_CONSOLE_OUTPUT_BYTES,
  MAX_LUA_CONSOLE_OUTPUT_LINES,
  MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH,
  MAX_LUA_CONSOLE_RETURN_BYTES,
  MAX_LUA_CONSOLE_RETURN_VALUES,
} from './game-protocol-limits.ts'
import type { GameDisconnectCode, ServerGameMessage } from './game-server-messages.ts'
import { PARTY_ACTIONS, PARTY_ACTION_REJECTIONS } from './game-server-messages.ts'

export function encodeGameMessage(message: ClientGameMessage | ServerGameMessage): string {
  return JSON.stringify(message)
}

export function decodeClientGameMessage(payload: string): ClientGameMessage {
  const value = parseObject(payload)
  if (value.type === 'client-observer-hello') {
    onlyKeys(value, 'message', ['type', 'credential', 'protocolVersion'])
    return {
      type: 'client-observer-hello',
      credential: limitedString(value.credential, 'credential', 512),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
    }
  }
  if (value.type === 'client-hello') {
    onlyKeys(value, 'message', [
      'type',
      'allowModMismatch',
      'beginCollegeIntro',
      'cheatsEnabled',
      'declineTutorial',
      'onlinePreferences',
      'protocolVersion',
      'credential',
      'character',
      'profile',
      'resumeToken',
      'save',
      'saveIntent',
    ])
    if ((value.save === undefined) !== (value.saveIntent === undefined)) {
      throw new GameProtocolError('save and saveIntent must be supplied together')
    }
    return {
      type: 'client-hello',
      cheatsEnabled: boolean(value.cheatsEnabled, 'cheatsEnabled'),
      onlinePreferences: gameOnlinePreferences(value.onlinePreferences, 'onlinePreferences'),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      credential: limitedString(value.credential, 'credential', 512),
      character: playerCharacterConfig(value.character, 'character'),
      profile: playerSocialProfile(value.profile, 'profile'),
      ...(value.beginCollegeIntro === undefined
        ? {}
        : { beginCollegeIntro: boolean(value.beginCollegeIntro, 'beginCollegeIntro') }),
      ...(value.declineTutorial === undefined
        ? {}
        : { declineTutorial: boolean(value.declineTutorial, 'declineTutorial') }),
      ...(value.allowModMismatch === undefined
        ? {}
        : { allowModMismatch: boolean(value.allowModMismatch, 'allowModMismatch') }),
      ...(value.resumeToken === undefined
        ? {}
        : { resumeToken: limitedString(value.resumeToken, 'resumeToken', 512) }),
      ...(value.save === undefined
        ? {}
        : {
            save: byteLimitedString(
              value.save,
              'save',
              MAX_WEB_GAME_SAVE_BYTES,
            ),
            saveIntent: memberString(
              value.saveIntent,
              'saveIntent',
              ['new-game', 'resume'] as const,
            ),
          }),
    }
  }
  if (value.type === 'client-input') {
    onlyKeys(value, 'message', ['type', 'input', 'sequence', 'targetTick'])
    return {
      type: 'client-input',
      input: decodePlayerCharacterInput(value.input, 'input'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
      targetTick: nonnegativeInteger(value.targetTick, 'targetTick'),
    }
  }
  if (value.type === 'client-hub-action') {
    onlyKeys(value, 'message', ['type', 'action'])
    return { type: 'client-hub-action', action: hubInventoryAction(value.action) }
  }
  if (value.type === 'client-hub-activity') {
    onlyKeys(value, 'message', ['type', 'activity'])
    return {
      type: 'client-hub-activity',
      activity: value.activity === null
        ? null
        : hubPlayerActivity(value.activity, 'activity'),
    }
  }
  if (value.type === 'client-online-preferences') {
    onlyKeys(value, 'message', ['type', 'onlinePreferences'])
    return {
      type: 'client-online-preferences',
      onlinePreferences: gameOnlinePreferences(value.onlinePreferences, 'onlinePreferences'),
    }
  }
  if (value.type === 'client-chat') {
    onlyKeys(value, 'message', ['type', 'channel', 'targetPlayerReference', 'text'])
    const channel = gameChatChannel(value.channel, 'channel')
    if ((channel === 'whisper') !== (value.targetPlayerReference !== undefined)) {
      throw new GameProtocolError(
        'targetPlayerReference is required exactly when the channel is whisper',
      )
    }
    return {
      type: 'client-chat',
      channel,
      ...(value.targetPlayerReference === undefined
        ? {}
        : {
            targetPlayerReference: playerTarget(
              value.targetPlayerReference,
              'targetPlayerReference',
            ),
          }),
      text: gameChatText(value.text, 'text'),
    }
  }
  if (value.type === 'client-player-card-request') {
    onlyKeys(value, 'message', ['type', 'playerReference', 'requestId'])
    return {
      type: 'client-player-card-request',
      playerReference: playerReference(value.playerReference, 'playerReference'),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-college-invite') {
    onlyKeys(value, 'message', ['type', 'playerReference'])
    return {
      type: 'client-college-invite',
      playerReference: playerReference(value.playerReference, 'playerReference'),
    }
  }
  if (value.type === 'client-college-invitation-dismiss') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-college-invitation-dismiss',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-invite') {
    onlyKeys(value, 'message', ['type', 'targetPlayerId'])
    return {
      type: 'client-party-invite',
      targetPlayerId: validatedPlayerId(value.targetPlayerId, 'targetPlayerId'),
    }
  }
  if (value.type === 'client-party-accept') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-party-accept',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-deny') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-party-deny',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-settings') {
    onlyKeys(value, 'message', ['type', 'visibility'])
    return {
      type: 'client-party-settings',
      visibility: partyVisibility(value.visibility, 'visibility'),
    }
  }
  if (value.type === 'client-party-rotate-code') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-party-rotate-code' }
  }
  if (value.type === 'client-party-request-accept') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-party-request-accept',
      requestId: partyIdentifier(value.requestId, 'requestId'),
    }
  }
  if (value.type === 'client-party-request-deny') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-party-request-deny',
      requestId: partyIdentifier(value.requestId, 'requestId'),
    }
  }
  if (value.type === 'client-party-leave') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-party-leave' }
  }
  if (value.type === 'client-party-kick') {
    onlyKeys(value, 'message', ['type', 'targetPlayerId'])
    return {
      type: 'client-party-kick',
      targetPlayerId: validatedPlayerId(value.targetPlayerId, 'targetPlayerId'),
    }
  }
  if (value.type === 'client-select-skill') {
    onlyKeys(value, 'message', ['type', 'choiceIndex', 'offerSequence', 'skillId'])
    const choiceIndex = nonnegativeInteger(value.choiceIndex, 'choiceIndex')
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (choiceIndex > 3) throw new GameProtocolError('choiceIndex is out of range')
    if (skillId < 8 || skillId > 79) throw new GameProtocolError('skillId is out of range')
    return {
      type: 'client-select-skill',
      choiceIndex,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
      skillId,
    }
  }
  if (value.type === 'client-skill-quickbar-bind') {
    onlyKeys(value, 'message', ['type', 'skillId', 'slot'])
    const skillId = value.skillId === null
      ? null
      : nonnegativeInteger(value.skillId, 'skillId')
    const slot = nonnegativeInteger(value.slot, 'slot')
    if (skillId !== null && !isNativeBeltSkill(skillId)) {
      throw new GameProtocolError('skillId is not a native quickbar skill')
    }
    if (slot > 7) throw new GameProtocolError('slot is out of range')
    return { type: 'client-skill-quickbar-bind', skillId, slot }
  }
  if (value.type === 'client-select-primary-skill') {
    onlyKeys(value, 'message', ['type', 'skillId'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (nativeSkillCategory(skillId) !== 1) {
      throw new GameProtocolError('skillId is not a native primary attack')
    }
    return { type: 'client-select-primary-skill', skillId }
  }
  if (value.type === 'client-select-concentration') {
    onlyKeys(value, 'message', ['type', 'skillId'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (nativeSkillCategory(skillId) !== 3) {
      throw new GameProtocolError('skillId is not a native concentration')
    }
    return { type: 'client-select-concentration', skillId }
  }
  if (value.type === 'client-select-concentration-slot') {
    onlyKeys(value, 'message', ['type', 'skillId', 'slot'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    const slot = nonnegativeInteger(value.slot, 'slot')
    if (nativeSkillCategory(skillId) !== 3) {
      throw new GameProtocolError('skillId is not a native concentration')
    }
    if (slot > 1) throw new GameProtocolError('concentration slot is out of range')
    return { type: 'client-select-concentration-slot', skillId, slot: slot as 0 | 1 }
  }
  if (value.type === 'client-level-up-action') {
    onlyKeys(value, 'message', ['type', 'action', 'offerSequence'])
    const action = limitedString(value.action, 'action', 16)
    if (action !== 'reroll' && action !== 'save') {
      throw new GameProtocolError('level-up action is not supported')
    }
    return {
      type: 'client-level-up-action',
      action,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
    }
  }
  if (value.type === 'client-ping') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'client-ping', nonce: pingNonce(value.nonce) }
  }
  if (value.type === 'client-snapshot-ack') {
    onlyKeys(value, 'message', ['type', 'requireKeyframe', 'sequence'])
    return {
      type: 'client-snapshot-ack',
      requireKeyframe: boolean(value.requireKeyframe, 'requireKeyframe'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'client-start-match') {
    onlyKeys(value, 'message', ['type', 'boneyardId'])
    return {
      type: 'client-start-match',
      boneyardId: limitedString(value.boneyardId, 'boneyardId', 256),
    }
  }
  if (value.type === 'client-start-tutorial') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-start-tutorial' }
  }
  if (value.type === 'client-ready-college-intro') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-ready-college-intro' }
  }
  if (value.type === 'client-ready-boneyard') {
    onlyKeys(value, 'message', ['type', 'runId'])
    return {
      type: 'client-ready-boneyard',
      runId: limitedString(value.runId, 'runId', 128),
    }
  }
  if (value.type === 'client-resume-grace-ready') {
    onlyKeys(value, 'message', ['type', 'sequence'])
    return {
      type: 'client-resume-grace-ready',
      sequence: positiveInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'client-tutorial-action') {
    onlyKeys(value, 'message', ['type', 'action'])
    return {
      type: 'client-tutorial-action',
      action: memberString(
        value.action,
        'action',
        NATIVE_TUTORIAL_SURFACE_ACTIONS,
      ),
    }
  }
  if (value.type === 'client-continue-game-over') {
    onlyKeys(value, 'message', ['type', 'eventId', 'runId'])
    return {
      type: 'client-continue-game-over',
      eventId: positiveInteger(value.eventId, 'eventId'),
      runId: limitedString(value.runId, 'runId', 128),
    }
  }
  if (value.type === 'client-confirm-loadout') {
    onlyKeys(value, 'message', ['type', 'discipline', 'displayName', 'element'])
    const discipline = limitedString(value.discipline, 'discipline', 32)
    const element = limitedString(value.element, 'element', 32)
    if (!isWizardDiscipline(discipline)) {
      throw new GameProtocolError('discipline is not supported')
    }
    if (!isWizardElement(element)) {
      throw new GameProtocolError('element is not supported')
    }
    return {
      type: 'client-confirm-loadout',
      discipline,
      displayName: limitedString(value.displayName, 'displayName', 64),
      element,
    }
  }
  if (value.type === 'client-gameplay-pause') {
    const paused = boolean(value.paused, 'paused')
    if (!paused) {
      onlyKeys(value, 'message', ['type', 'paused'])
      return { type: 'client-gameplay-pause', paused }
    }
    onlyKeys(value, 'message', ['type', 'paused', 'source'])
    return { type: 'client-gameplay-pause', paused, source: gameplayPauseSource(value.source) }
  }
  if (value.type === 'client-cheat-mode') {
    onlyKeys(value, 'message', ['type', 'enabled'])
    return {
      type: 'client-cheat-mode',
      enabled: boolean(value.enabled, 'enabled'),
    }
  }
  if (value.type === 'client-lua-execute') {
    onlyKeys(value, 'message', ['type', 'code', 'requestId'])
    const code = limitedString(value.code, 'code', MAX_LUA_CONSOLE_CODE_LENGTH)
    if (encodedByteLength(code) > MAX_LUA_CONSOLE_CODE_LENGTH) {
      throw new GameProtocolError(`code may contain at most ${MAX_LUA_CONSOLE_CODE_LENGTH} bytes`)
    }
    return {
      type: 'client-lua-execute',
      code,
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-mod-cast') {
    onlyKeys(value, 'message', ['type', 'contentId', 'requestId', 'targetX', 'targetY'])
    const contentId = limitedString(value.contentId, 'contentId', 19)
    if (!/^[1-9][0-9]{0,18}$/.test(contentId)) throw new GameProtocolError('contentId is invalid')
    return {
      type: 'client-mod-cast',
      contentId,
      requestId: luaRequestId(value.requestId),
      targetX: finite(value.targetX, 'targetX'),
      targetY: finite(value.targetY, 'targetY'),
    }
  }
  if (value.type === 'client-mod-action') {
    onlyKeys(value, 'message', ['type', 'action', 'arguments', 'requestId', 'target'])
    const action = limitedString(value.action, 'action', 32)
    const args = luaConsoleValue(value.arguments, 'arguments', { nodes: 0 }, 0)
    if (!(MOD_ACTIONS as readonly string[]).includes(action) || !args ||
        typeof args !== 'object' || Array.isArray(args)) {
      throw new GameProtocolError('mod action is invalid')
    }
    return {
      type: 'client-mod-action',
      action: action as ModAction,
      arguments: args as LuaConsoleObject,
      requestId: luaRequestId(value.requestId),
      target: limitedString(value.target, 'target', 256),
    }
  }
  if (value.type === 'client-disconnect') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-disconnect' }
  }
  if (value.type === 'client-save-before-leave') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-save-before-leave',
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-deployment-ready') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'targetRevision'])
    return {
      type: 'client-deployment-ready',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      targetRevision: gitRevision(value.targetRevision, 'targetRevision'),
    }
  }
  throw new GameProtocolError('unknown client message type')
}

export function decodeServerGameMessage(payload: string): ServerGameMessage {
  const value = parseObject(payload)
  if (value.type === 'server-welcome') {
    onlyKeys(value, 'message', [
      'type',
      'cheatsEnabled',
      'developerAccess',
      'protocolVersion',
      'playerId',
      'resumeToken',
      'serverTickRate',
      'snapshotRate',
      'sessionKind',
      'kernelParameters',
      'content',
      'modAssets',
      'modCatalog',
      'boneyards',
      'gameplayPause',
      'gameplayResumeGrace',
      'observer',
      'snapshot',
      'snapshotSequence',
    ])
    const snapshot = gameSnapshot(value.snapshot)
    const gameplayPause = value.gameplayPause === null
      ? null
      : gameplayPauseState(value.gameplayPause, 'gameplayPause')
    const gameplayResumeGrace = value.gameplayResumeGrace === null
      ? null
      : gameplayResumeGraceState(value.gameplayResumeGrace, 'gameplayResumeGrace')
    if (gameplayPause && !snapshot.players[gameplayPause.ownerPlayerId]) {
      throw new GameProtocolError('gameplayPause owner is absent from the welcome snapshot')
    }
    return {
      type: 'server-welcome',
      cheatsEnabled: boolean(value.cheatsEnabled, 'cheatsEnabled'),
      developerAccess: boolean(value.developerAccess, 'developerAccess'),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      playerId: validatedPlayerId(value.playerId, 'playerId'),
      resumeToken: limitedString(value.resumeToken, 'resumeToken', 512),
      serverTickRate: positiveFinite(value.serverTickRate, 'serverTickRate'),
      snapshotRate: positiveFinite(value.snapshotRate, 'snapshotRate'),
      sessionKind: gameSessionKind(value.sessionKind),
      kernelParameters: playerCharacterKernelParameters(value.kernelParameters),
      content: contentManifest(value.content),
      modAssets: gameModAssets(value.modAssets),
      modCatalog: modConsumableCatalog(value.modCatalog, 'modCatalog'),
      boneyards: boneyardChoices(value.boneyards),
      gameplayPause,
      gameplayResumeGrace,
      ...(value.observer === undefined
        ? {}
        : { observer: boolean(value.observer, 'observer') }),
      snapshot,
      snapshotSequence: nonnegativeInteger(value.snapshotSequence, 'snapshotSequence'),
    }
  }
  if (value.type === 'server-mod-catalog') {
    onlyKeys(value, 'message', ['type', 'items'])
    return {
      type: 'server-mod-catalog',
      items: modConsumableCatalog(value.items, 'items'),
    }
  }
  if (value.type === 'server-mod-content') {
    onlyKeys(value, 'message', [
      'type', 'boasts', 'content', 'manifestSha256', 'powerups', 'revision', 'statuses',
    ])
    return { type: 'server-mod-content', ...modContentProjection(value) }
  }
  if (value.type === 'server-mod-runtime') {
    onlyKeys(value, 'message', ['type', 'projection', 'revision'])
    const projection = luaConsoleValue(value.projection, 'projection', { nodes: 0 }, 0)
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
      throw new GameProtocolError('mod runtime projection is invalid')
    }
    return {
      type: 'server-mod-runtime',
      projection: projection as LuaConsoleObject,
      revision: nonnegativeInteger(value.revision, 'revision'),
    }
  }
  if (value.type === 'server-snapshot') {
    onlyKeys(value, 'message', [
      'type',
      'acknowledgedInputSequence',
      'frame',
      'sequence',
    ])
    return {
      type: 'server-snapshot',
      acknowledgedInputSequence: nonnegativeInteger(
        value.acknowledgedInputSequence,
        'acknowledgedInputSequence',
      ),
      frame: gameSnapshotFrame(value.frame),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'server-boneyard-loaded') {
    onlyKeys(value, 'message', ['type', 'boneyard'])
    return {
      type: 'server-boneyard-loaded',
      boneyard: loadedBoneyard(value.boneyard),
    }
  }
  if (value.type === 'server-save-checkpoint') {
    onlyKeys(value, 'message', ['type', 'save', 'reason', 'sequence'])
    const reason = memberString(
      value.reason,
      'reason',
      ['game-over', 'progress'] as const,
    )
    const save = byteLimitedString(value.save, 'save', MAX_WEB_GAME_SAVE_BYTES)
    return {
      type: 'server-save-checkpoint',
      save,
      reason,
      sequence: positiveInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'server-save-before-leave') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'requestId'])
    return {
      type: 'server-save-before-leave',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'server-deployment-restart') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'targetRevision'])
    return {
      type: 'server-deployment-restart',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      targetRevision: gitRevision(value.targetRevision, 'targetRevision'),
    }
  }
  if (value.type === 'server-leaderboard-receipt') {
    onlyKeys(value, 'message', ['type', 'receipt'])
    return {
      type: 'server-leaderboard-receipt',
      receipt: byteLimitedString(
        value.receipt,
        'receipt',
        MAX_GAME_LEADERBOARD_RECEIPT_BYTES,
      ),
    }
  }
  if (value.type === 'server-pong') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'server-pong', nonce: pingNonce(value.nonce) }
  }
  if (value.type === 'server-gameplay-pause') {
    onlyKeys(value, 'message', ['type', 'pause'])
    return {
      type: 'server-gameplay-pause',
      pause: value.pause === null ? null : gameplayPauseState(value.pause, 'pause'),
    }
  }
  if (value.type === 'server-gameplay-resume-grace') {
    onlyKeys(value, 'message', ['type', 'grace'])
    return {
      type: 'server-gameplay-resume-grace',
      grace: value.grace === null
        ? null
        : gameplayResumeGraceState(value.grace, 'grace'),
    }
  }
  if (value.type === 'server-party-state') {
    onlyKeys(value, 'message', ['type', 'state'])
    return { type: 'server-party-state', state: localPartyState(value.state) }
  }
  if (value.type === 'server-party-action') {
    onlyKeys(value, 'message', ['type', 'action', 'ok', 'reason'])
    const ok = boolean(value.ok, 'ok')
    const reason = value.reason === null
      ? null
      : memberString(value.reason, 'reason', PARTY_ACTION_REJECTIONS)
    if (ok !== (reason === null)) {
      throw new GameProtocolError('party action ok and reason fields are inconsistent')
    }
    return {
      type: 'server-party-action',
      action: memberString(value.action, 'action', PARTY_ACTIONS),
      ok,
      reason,
    }
  }
  if (value.type === 'server-cheat-mode') {
    onlyKeys(value, 'message', ['type', 'enabled'])
    return {
      type: 'server-cheat-mode',
      enabled: boolean(value.enabled, 'enabled'),
    }
  }
  if (value.type === 'server-player-card') {
    onlyKeys(value, 'message', ['type', 'profile', 'requestId'])
    return {
      type: 'server-player-card',
      profile: value.profile === null
        ? null
        : gamePlayerCardProfile(value.profile, 'profile'),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'server-college-invitations') {
    onlyKeys(value, 'message', ['type', 'invitations'])
    return {
      type: 'server-college-invitations',
      invitations: gameCollegeInvitations(value.invitations),
    }
  }
  if (value.type === 'server-chat') {
    onlyKeys(value, 'message', [
      'type', 'activity', 'channel', 'recipient', 'sender', 'sequence', 'text',
    ])
    const channel = gameChatChannel(value.channel, 'channel')
    if ((channel === 'whisper') !== (value.recipient !== undefined)) {
      throw new GameProtocolError(
        'recipient is required exactly when the channel is whisper',
      )
    }
    const sender = gameChatSender(value.sender, 'sender')
    const activity = value.activity === undefined
      ? undefined
      : memberString(value.activity, 'activity', GAME_CHAT_ACTIVITIES)
    if (activity !== undefined && channel !== 'global') {
      throw new GameProtocolError('activity messages require the global channel')
    }
    const text = activity === undefined
      ? gameChatText(value.text, 'text')
      : limitedString(value.text, 'text', GAME_CHAT_MAX_TEXT_CODE_UNITS)
    if (activity !== undefined && text !== gameChatActivityText(activity, sender.displayName)) {
      throw new GameProtocolError('activity text does not match its host-authored event')
    }
    return {
      type: 'server-chat',
      ...(activity === undefined ? {} : { activity }),
      channel,
      ...(value.recipient === undefined
        ? {}
        : { recipient: gameChatSender(value.recipient, 'recipient') }),
      sender,
      sequence: positiveInteger(value.sequence, 'sequence'),
      text,
    }
  }
  if (value.type === 'server-chat-rejected') {
    onlyKeys(value, 'message', ['type', 'channel', 'reason', 'retryAfterMs'])
    return {
      type: 'server-chat-rejected',
      channel: gameChatChannel(value.channel, 'channel'),
      reason: gameChatRejectionReason(value.reason),
      retryAfterMs: integerWithin(value.retryAfterMs, 'retryAfterMs', 0, 60_000),
    }
  }
  if (value.type === 'server-lua-result') {
    onlyKeys(value, 'message', [
      'type',
      'error',
      'ok',
      'output',
      'requestId',
      'values',
    ])
    const budget = { nodes: 0 }
    const ok = boolean(value.ok, 'ok')
    const error = value.error === null
      ? null
      : byteLimitedString(value.error, 'error', MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH)
    if (ok !== (error === null)) {
      throw new GameProtocolError('Lua result ok and error fields are inconsistent')
    }
    const output = limitedArray(
      value.output,
      'output',
      MAX_LUA_CONSOLE_OUTPUT_LINES,
    ).map((line, index) => boundedString(
      line,
      `output[${index}]`,
      MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH,
    ))
    if (encodedByteLength(output) > MAX_LUA_CONSOLE_OUTPUT_BYTES) {
      throw new GameProtocolError('Lua result output exceeds its byte limit')
    }
    const values = limitedArray(
      value.values,
      'values',
      MAX_LUA_CONSOLE_RETURN_VALUES,
    ).map((entry, index) => luaConsoleValue(
      entry,
      `values[${index}]`,
      budget,
      0,
    ))
    if (encodedByteLength(values) > MAX_LUA_CONSOLE_RETURN_BYTES) {
      throw new GameProtocolError('Lua result values exceed their byte limit')
    }
    return {
      type: 'server-lua-result',
      error,
      ok,
      output,
      requestId: luaRequestId(value.requestId),
      values,
    }
  }
  if (value.type === 'server-disconnect') {
    onlyKeys(value, 'message', ['type', 'code', 'reason'])
    const code = limitedString(value.code, 'code', 64)
    if (![
      'authentication-failed',
      'invalid-message',
      'protocol-mismatch',
      'server-full',
    ].includes(code)) throw new GameProtocolError('invalid disconnect code')
    return {
      type: 'server-disconnect',
      code: code as GameDisconnectCode,
      reason: limitedString(value.reason, 'reason', 512),
    }
  }
  throw new GameProtocolError('unknown server message type')
}
