import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { createPeerRooms } from './peer-rooms.mjs'

export async function startPeerSignaling({
  host = '127.0.0.1', port = 0, iceServers = [],
  maxRooms = 128, maxGuests = 7, trustedProxy = false,
} = {}) {
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('Peer signaling must bind to loopback behind a TLS proxy')
  }
  const peers = new Map()
  const addresses = new Map()
  const rooms = createPeerRooms({ send, iceServers, maxRooms, maxGuests })
  const server = createServer((request, response) => {
    response.writeHead(request.url === '/health' ? 200 : 404, {
      'content-type': 'application/json', 'cache-control': 'no-store',
    })
    response.end(JSON.stringify(request.url === '/health' ? { status: 'ok' } : { error: 'Not found' }))
  })
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 96 * 1024, perMessageDeflate: false })
  server.on('upgrade', (request, socket, head) => {
    const address = trustedProxy && typeof request.headers['x-forwarded-for'] === 'string'
      ? request.headers['x-forwarded-for'].split(',').at(-1).trim()
      : request.socket.remoteAddress
    if (request.url !== '/desktop-signal' || request.headers.origin !== 'sdr://desktop') {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    if (peers.size >= 512 || (addresses.get(address) ?? 0) >= 16) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n')
      return
    }
    sockets.handleUpgrade(request, socket, head, ws => {
      const peer = { ws, room: null, id: null, alive: true, count: 0, window: Date.now() }
      peers.set(ws, peer)
      addresses.set(address, (addresses.get(address) ?? 0) + 1)
      const idle = setTimeout(() => { if (!peer.room) ws.close(1008, 'Admission timeout') }, 30_000)
      idle.unref()
      ws.on('error', () => {}) // A malformed frame terminates only its socket.
      ws.on('pong', () => { peer.alive = true })
      ws.on('message', (raw, binary) => {
        try {
          if (Date.now() - peer.window > 60_000) { peer.window = Date.now(); peer.count = 0 }
          if (++peer.count > 120 || binary) throw new Error('Signaling rate or message type rejected')
          rooms.receive(peer, JSON.parse(raw.toString()))
        } catch (error) {
          send(peer, { type: 'error', message: error instanceof SyntaxError ? 'Invalid signaling message' : error.message })
        }
      })
      ws.once('close', () => {
        clearTimeout(idle)
        peers.delete(ws)
        const count = (addresses.get(address) ?? 1) - 1
        if (count) addresses.set(address, count)
        else addresses.delete(address)
        rooms.drop(peer)
      })
    })
  })
  const heartbeat = setInterval(() => {
    for (const peer of peers.values()) {
      if (!peer.alive) peer.ws.terminate()
      else { peer.alive = false; peer.ws.ping() }
    }
    rooms.expire()
  }, 15_000)
  heartbeat.unref()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })
  return {
    url: `ws://${host === '::1' ? '[::1]' : host}:${server.address().port}/desktop-signal`,
    async close() {
      clearInterval(heartbeat)
      for (const ws of peers.keys()) ws.terminate()
      sockets.close()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}

function send(peer, message) {
  const ws = peer.ws
  if (ws.readyState !== WebSocket.OPEN) return
  if (ws.bufferedAmount > 256 * 1024) { ws.close(1008, 'Signaling receiver too slow'); return }
  ws.send(JSON.stringify(message))
}
