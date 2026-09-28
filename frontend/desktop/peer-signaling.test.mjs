import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import WebSocket from 'ws'

import { startPeerSignaling } from './peer-signaling.mjs'

const revision = 'a'.repeat(40)

async function connection(context, url) {
  const ws = new WebSocket(url, { origin: 'sdr://desktop' })
  const messages = []
  const pending = []
  ws.on('message', raw => {
    const message = JSON.parse(raw.toString())
    if (pending.length) pending.shift()(message)
    else messages.push(message)
  })
  context.after(() => ws.terminate())
  await once(ws, 'open')
  return {
    ws,
    send: message => ws.send(JSON.stringify(message)),
    next: () => messages.length ? Promise.resolve(messages.shift()) : new Promise(resolve => pending.push(resolve)),
  }
}

test('invites connect exact-compatible peers and route SDP only within their room', { timeout: 5_000 }, async context => {
  const service = await startPeerSignaling({ iceServers: [] })
  context.after(() => service.close())
  const host = await connection(context, service.url)
  host.send({ type: 'host', protocol: 7, revision })
  const invite = await host.next()
  assert.equal(invite.type, 'hosted')
  assert.match(invite.code, /^[A-Za-z0-9_-]{32}$/)
  assert.equal(JSON.stringify(invite).includes('credential'), false)

  const mismatch = await connection(context, service.url)
  mismatch.send({ type: 'join', code: invite.code, protocol: 8, revision })
  assert.match((await mismatch.next()).message, /same game build/)

  const guest = await connection(context, service.url)
  guest.send({ type: 'join', code: invite.code, protocol: 7, revision })
  const joined = await guest.next()
  assert.equal(joined.type, 'joined')
  assert.deepEqual(await host.next(), { type: 'peer-joined', peerId: joined.peerId })
  host.send({ type: 'signal', peerId: joined.peerId, description: { type: 'offer', sdp: 'test-offer' } })
  assert.deepEqual(await guest.next(), { type: 'signal', peerId: 'host', description: { type: 'offer', sdp: 'test-offer' } })
  guest.send({ type: 'signal', peerId: 'host', description: { type: 'answer', sdp: 'test-answer' } })
  assert.equal((await host.next()).description.sdp, 'test-answer')

  const outsider = await connection(context, service.url)
  outsider.send({ type: 'signal', peerId: joined.peerId, description: { type: 'offer', sdp: 'intrusion' } })
  assert.match((await outsider.next()).message, /Join or host/)
  outsider.send({ type: 'host', protocol: 7, revision })
  await outsider.next()
  outsider.send({ type: 'signal', peerId: joined.peerId, description: { type: 'offer', sdp: 'cross-room' } })
  assert.match((await outsider.next()).message, /not in this room/)
  host.ws.close()
  assert.equal((await guest.next()).type, 'host-left')
})

test('unknown invites and oversized/invalid messages fail without creating a room', { timeout: 5_000 }, async context => {
  const service = await startPeerSignaling({ iceServers: [] })
  context.after(() => service.close())
  const client = await connection(context, service.url)
  client.send({ type: 'join', code: 'x'.repeat(32), protocol: 7, revision })
  assert.match((await client.next()).message, /expired or unavailable/)
  client.send({ type: 'host', protocol: -1, revision: 'not-a-revision' })
  assert.match((await client.next()).message, /Invalid game build/)
  const rejected = new WebSocket(service.url, { origin: 'https://untrusted.example' })
  const error = await new Promise(resolve => rejected.once('error', resolve))
  assert.match(error.message, /403/)
  const closed = once(client.ws, 'close')
  client.ws.send('x'.repeat(100 * 1024))
  assert.equal((await closed)[0], 1009)
})
