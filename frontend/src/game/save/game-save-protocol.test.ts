import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_PROTOCOL_VERSION,
  GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
  decodeClientGameMessage,
  decodeServerGameMessage,
} from '../protocol/game-protocol.ts'
import { MAX_WEB_GAME_SAVE_BYTES } from './game-save-contract.ts'
import { readGameResumeToken, rememberGameResumeToken } from './game-resume-token.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('protocol carries one bounded resume document and ordered host checkpoints', () => {
  assert.equal(GAME_PROTOCOL_VERSION, 104)
  assert.equal(
    GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
    MAX_WEB_GAME_SAVE_BYTES * 2 + 64 * 1024,
  )
  const document = JSON.stringify({ schemaVersion: 1 })
  assert.deepEqual(decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'secret',
    character: CHARACTER,
    save: document,
    saveIntent: 'resume',
  })), {
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'secret',
    character: CHARACTER,
    save: document,
    saveIntent: 'resume',
  })
  assert.deepEqual(decodeServerGameMessage(JSON.stringify({
    type: 'server-save-checkpoint',
    save: document,
    reason: 'progress',
    sequence: 9,
  })), {
    type: 'server-save-checkpoint',
    save: document,
    reason: 'progress',
    sequence: 9,
  })
  assert.deepEqual(decodeServerGameMessage(JSON.stringify({
    type: 'server-save-checkpoint',
    save: document,
    reason: 'game-over',
    sequence: 10,
  })), {
    type: 'server-save-checkpoint',
    save: document,
    reason: 'game-over',
    sequence: 10,
  })
  const targetRevision = 'a'.repeat(40)
  assert.deepEqual(decodeServerGameMessage(JSON.stringify({
    type: 'server-deployment-restart',
    checkpointSequence: 9,
    targetRevision,
  })), {
    type: 'server-deployment-restart',
    checkpointSequence: 9,
    targetRevision,
  })
  assert.deepEqual(decodeClientGameMessage(JSON.stringify({
    type: 'client-deployment-ready',
    checkpointSequence: 9,
    targetRevision,
  })), {
    type: 'client-deployment-ready',
    checkpointSequence: 9,
    targetRevision,
  })
  assert.deepEqual(decodeClientGameMessage(JSON.stringify({
    type: 'client-save-before-leave',
    requestId: 7,
  })), {
    type: 'client-save-before-leave',
    requestId: 7,
  })
  assert.deepEqual(decodeServerGameMessage(JSON.stringify({
    type: 'server-save-before-leave',
    checkpointSequence: 10,
    requestId: 7,
  })), {
    type: 'server-save-before-leave',
    checkpointSequence: 10,
    requestId: 7,
  })
})

test('protocol rejects oversized and inconsistent save messages', () => {
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'secret',
    character: CHARACTER,
    save: 'x'.repeat(MAX_WEB_GAME_SAVE_BYTES + 1),
    saveIntent: 'resume',
  })), /save/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-save-checkpoint',
    save: null,
    reason: 'progress',
    sequence: 1,
  })), /save/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-save-checkpoint',
    save: null,
    reason: 'game-over',
    sequence: 1,
  })), /save/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'secret',
    character: CHARACTER,
    save: '{}',
  })), /saveIntent/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'secret',
    character: CHARACTER,
    saveIntent: 'new-game',
  })), /save/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-deployment-restart',
    checkpointSequence: 1,
    targetRevision: 'main',
  })), /targetRevision/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-deployment-ready',
    checkpointSequence: -1,
    targetRevision: 'a'.repeat(40),
  })), /checkpointSequence/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-save-before-leave',
    requestId: 0,
  })), /requestId/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-save-before-leave',
    checkpointSequence: -1,
    requestId: 7,
  })), /checkpointSequence/)
})

test('resume tokens stay scoped to one saved player and rotate in session storage', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }

  assert.equal(readGameResumeToken('player-one', storage), undefined)
  rememberGameResumeToken('player-one', 'first-token', storage)
  rememberGameResumeToken('player-two', 'other-token', storage)
  assert.equal(readGameResumeToken('player-one', storage), 'first-token')
  assert.equal(readGameResumeToken('player-two', storage), 'other-token')
  rememberGameResumeToken('player-one', 'rotated-token', storage)
  assert.equal(readGameResumeToken('player-one', storage), 'rotated-token')
})

test('resume-token storage denial preserves ordinary save restore', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  assert.equal(readGameResumeToken('player-one', blocked), undefined)
  assert.doesNotThrow(() => rememberGameResumeToken('player-one', 'token', blocked))
})
