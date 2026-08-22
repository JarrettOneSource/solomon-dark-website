import assert from 'node:assert/strict'

import { WebSocket } from 'ws'

import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'
import {
  EntityReplicationGapError,
  EntityReplicationReconstructor,
} from '../src/game/protocol/entity-replication.ts'

const provisionUrl = process.env.SDR_GAME_PROVISION_URL
  || 'https://solomondarker.com/api/game/sessions'
const browserOrigin = process.env.SDR_GAME_ORIGIN || new URL(provisionUrl).origin
const gatewayOverride = process.env.SDR_GAME_GATEWAY_URL

const response = await fetch(provisionUrl, {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'x-solomon-dark-session': 'provision',
  },
})
const payload = await response.json()
assert.equal(response.status, 200, JSON.stringify(payload))
assert.equal(response.headers.get('cache-control'), 'no-store')
assert.equal(payload.kind, 'remote')
assert.equal(payload.sessionKind, 'private-college')
assert.equal(typeof payload.url, 'string')
assert.equal(typeof payload.credential, 'string')

const publicEndpoint = new URL(payload.url)
assert.equal(publicEndpoint.protocol, 'wss:')
const transportEndpoint = gatewayOverride
  ? new URL(publicEndpoint.pathname, gatewayOverride).toString()
  : publicEndpoint.toString()
const socket = await openSocket(transportEndpoint, browserOrigin)

try {
  socket.send(encodeGameMessage({
    type: 'client-hello',
    cheatsEnabled: false,
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: payload.credential,
    character: {
      discipline: 'arcane',
      displayName: 'Smoke Wizard',
      element: 'ether',
    },
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  const before = welcome.snapshot.players[welcome.playerId].position.x
  const replication = {
    lastSequence: welcome.snapshotSequence,
    reconstructor: new EntityReplicationReconstructor(),
  }
  replication.reconstructor.reset(welcome.snapshot, welcome.snapshotSequence)
  socket.send(encodeGameMessage({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: false, quickbar: null },
      movement: { x: 1, y: 0 },
    },
    sequence: 1,
    targetTick: welcome.snapshot.tick + 1,
  }))
  const moved = await nextSnapshot(socket, replication, (message, snapshot) => (
    message.acknowledgedInputSequence === 1
    && snapshot.players[welcome.playerId].position.x > before
  ))
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    endpoint: publicEndpoint.toString(),
    playerId: welcome.playerId,
    protocolVersion: welcome.protocolVersion,
    before,
    after: moved.snapshot.players[welcome.playerId].position.x,
  })}\n`)
} finally {
  socket.close(1000, 'smoke complete')
}

function openSocket(url, origin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, upgradeResponse) => {
      reject(new Error(`upgrade rejected with ${upgradeResponse.statusCode}`))
    })
  })
}

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 5000)
    const receive = (data) => {
      const message = decodeServerGameMessage(data.toString())
      if (!predicate(message)) return
      cleanup()
      resolve(message)
    }
    const fail = (error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function nextSnapshot(socket, replication, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game snapshot'))
    }, 5000)
    const receive = (data) => {
      let message
      try {
        message = decodeServerGameMessage(data.toString())
        if (message.type !== 'server-snapshot') return
        if (message.sequence <= replication.lastSequence) return
        const snapshot = replication.reconstructor.apply(message.frame, message.sequence)
        replication.lastSequence = message.sequence
        socket.send(encodeGameMessage({
          type: 'client-snapshot-ack',
          requireKeyframe: false,
          sequence: message.sequence,
        }))
        if (!predicate(message, snapshot)) return
        cleanup()
        resolve({ message, snapshot })
      } catch (error) {
        if (error instanceof EntityReplicationGapError) {
          socket.send(encodeGameMessage({
            type: 'client-snapshot-ack',
            requireKeyframe: true,
            sequence: replication.lastSequence,
          }))
          return
        }
        fail(error)
      }
    }
    const fail = (error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}
