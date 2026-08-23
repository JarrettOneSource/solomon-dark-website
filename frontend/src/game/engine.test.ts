import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameClientSessionOptions } from './client/game-client-session.ts'
import type { GameTransport } from './client/game-transport.ts'
import { bootGame } from './engine.ts'

const inertTransport: GameTransport = {
  readyState: 'open',
  close() {},
  onClose: () => () => {},
  onMessage: () => () => {},
  send() {},
}
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

const NULL_PROFILE = {
  accountUsername: null,
  highestWave: null,
  totalPlaytimeMs: null,
}

test('bootGame accepts a separate localhost server and routes through the shared connector', async () => {
  let connected: GameClientSessionOptions | undefined
  const session = inertSession()
  const result = await bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: {
      kind: 'localhost',
      sessionKind: 'standalone',
      url: 'ws://127.0.0.1:1234/game',
      credential: 'secret',
    },
    saveDocument: '{"schemaVersion":1}',
    transportFactory: async () => inertTransport,
    sessionConnector: async (options) => {
      connected = options
      return session
    },
  })
  assert.equal(result, session)
  assert.equal(connected?.credential, 'secret')
  assert.deepEqual(connected?.character, CHARACTER)
  assert.equal(connected?.saveDocument, '{"schemaVersion":1}')
  assert.equal(connected?.saveIntent, 'resume')
})

test('bootGame reports concrete transport and welcome milestones in order', async () => {
  const trace: string[] = []
  const session = inertSession()
  const result = await bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: {
      kind: 'localhost',
      sessionKind: 'standalone',
      url: 'ws://127.0.0.1:1234/game',
      credential: 'secret',
    },
    onProgress: (stage) => trace.push(stage),
    transportFactory: async () => {
      trace.push('transport-open')
      return inertTransport
    },
    sessionConnector: async () => {
      trace.push('welcome-received')
      return session
    },
  })

  assert.equal(result, session)
  assert.deepEqual(trace, [
    'connecting_transport',
    'transport-open',
    'authenticating_session',
    'welcome-received',
    'receiving_host_checkpoint',
  ])
})

test('bootGame bans website remote sessions from local and plaintext endpoints', async () => {
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'remote', sessionKind: 'private-college', url: 'ws://127.0.0.1:1234/game', credential: 'x' },
  }), /private networks/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'remote', sessionKind: 'private-college', url: 'ws://game.example.test/game', credential: 'x' },
  }), /must use wss/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'remote', sessionKind: 'private-college', url: 'wss://127.12.34.56/game', credential: 'x' },
  }), /private networks/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'remote', sessionKind: 'private-college', url: 'wss://game.local/game', credential: 'x' },
  }), /private networks/)
})

test('bootGame accepts any numeric IPv4 loopback address for a desktop-local server', async () => {
  const session = inertSession()
  const result = await bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'localhost', sessionKind: 'standalone', url: 'ws://127.12.34.56:1234/game', credential: 'x' },
    transportFactory: async () => inertTransport,
    sessionConnector: async () => session,
  })
  assert.equal(result, session)
})

test('bootGame rejects non-loopback addresses presented as desktop-local servers', async () => {
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    profile: NULL_PROFILE,
    endpoint: { kind: 'localhost', sessionKind: 'standalone', url: 'ws://192.168.1.20:1234/game', credential: 'x' },
  }), /loopback/)
})

function inertSession() {
  return {
    acceptPartyJoinRequest() {},
    acceptPartyInvitation() {},
    bindSkillQuickbar() {},
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' as const }],
    developerAccess: false,
    isHost: true,
    modAssets: [],
    playerId: 'p',
    resumeToken: 'r',
    sessionKind: 'standalone' as const,
    confirmLoadout() {},
    continueGameOver() {},
    executeLua: async () => ({ error: null, ok: true, output: [], values: [] }),
    destroy() {},
    denyPartyInvitation() {},
    denyPartyJoinRequest() {},
    getBoneyard: () => null,
    getChatMessages: () => [],
    getGameplayPause: () => null,
    getModCatalog: () => [],
    getPingMs: () => null,
    getPartyState: () => null,
    getSaveCheckpoint: () => null,
    getSnapshot() { throw new Error() },
    onBoneyard: () => () => {},
    onChatMessage: () => () => {},
    onChatRejected: () => () => {},
    onGameplayPause: () => () => {},
    onLeaderboardReceipt: () => () => {},
    onModCatalog: () => () => {},
    onEnemyEvent: () => () => {},
    onPing: () => () => {},
    onPartyState: () => () => {},
    onPartyAction: () => () => {},
    onSaveCheckpoint: () => () => {},
    onSnapshot: () => () => {},
    rerollSkill() {},
    requestGameplayPause() {},
    saveBeforeLeave: async () => { throw new Error('inert session') },
    sampleBoneyardPresentation() { throw new Error() },
    samplePresentation() { throw new Error() },
    saveSkill() {},
    selectConcentration() {},
    selectConcentrationSlot() {},
    selectPrimarySkill() {},
    selectSkill() {},
    sendChatMessage() {},
    sendHubAction() {},
    sendInput() {},
    setCheatsEnabled() {},
    inviteToParty() {},
    kickPartyPlayer() {},
    leaveParty() {},
    rotatePartyCode() {},
    setPartyVisibility() {},
    startMatch() {},
  }
}
