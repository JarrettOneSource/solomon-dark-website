import { GAME_PROTOCOL_VERSION } from '../game/protocol/game-protocol-contract.ts'
import { TITLE_BUILD_REVISION } from '../game/title-build-revision.ts'
import { peerDescription, peerIceServers } from './peer-negotiation.ts'

export interface PeerRoom {
  invite: string | null
  iceServers: RTCIceServer[]
  signal(peerId: string, description: RTCSessionDescriptionInit): void
  close(): void
}

interface RoomEvents {
  peerJoined(peerId: string): void
  peerLeft(peerId: string): void
  signal(peerId: string, description: RTCSessionDescriptionInit): void
  lost(message: string): void
}

export function openPeerRoom(url: string, mode: 'host' | 'guest', invite: string, events: RoomEvents): Promise<PeerRoom> {
  const address = new URL(url)
  if (address.username || address.password || address.hash
    || (address.protocol !== 'wss:' && !(address.protocol === 'ws:' && address.hostname === '127.0.0.1'))) {
    throw new Error('Friend invitations require a secure connection service')
  }
  const revision = TITLE_BUILD_REVISION.full
  if (!revision) throw new Error('Friend play requires a revisioned game build')
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    let admitted = false
    let closed = false
    const timeout = setTimeout(() => fail('Friend service did not respond. Offline play remains available.'), 10_000)
    const fail = (message: string) => {
      if (closed) return
      clearTimeout(timeout)
      if (!admitted) { reject(new Error(message)); closed = true; socket.close() }
      else events.lost(message)
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({
      type: mode === 'host' ? 'host' : 'join',
      ...(mode === 'guest' ? { code: invite } : {}),
      protocol: GAME_PROTOCOL_VERSION, revision,
    })))
    socket.addEventListener('message', event => {
      if (closed) return
      try {
        if (typeof event.data !== 'string' || event.data.length > 96 * 1024) throw new Error('Invalid signaling message')
        const value: unknown = JSON.parse(event.data)
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid signaling message')
        const message = value as Record<string, unknown>
        if (message.type === 'error') {
          fail(typeof message.message === 'string' ? message.message.slice(0, 240) : 'Friend connection failed')
          return
        }
        if (!admitted && (message.type === 'hosted' || message.type === 'joined')) {
          if ((mode === 'host') !== (message.type === 'hosted')) throw new Error('Unexpected invitation response')
          if (mode === 'host' && (typeof message.code !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(message.code))) {
            throw new Error('Invalid invitation code')
          }
          const iceServers = peerIceServers(message.iceServers)
          admitted = true
          clearTimeout(timeout)
          resolve({
            invite: typeof message.code === 'string' ? message.code : null,
            iceServers,
            signal(peerId, description) {
              if (closed || socket.readyState !== WebSocket.OPEN) throw new Error('Invitation service disconnected')
              socket.send(JSON.stringify({ type: 'signal', peerId, description: peerDescription(description) }))
            },
            close() { closed = true; clearTimeout(timeout); socket.close(1000, 'Leaving friend room') },
          })
          return
        }
        if (!admitted) throw new Error('Signaling arrived before admission')
        if (message.type === 'host-left') { events.lost('The invitation has closed. Existing peer links can continue.'); return }
        if (typeof message.peerId !== 'string' || !/^(host|[a-f0-9]{24})$/.test(message.peerId)) {
          throw new Error('Invalid peer identity')
        }
        if (message.type === 'peer-joined' && mode === 'host') events.peerJoined(message.peerId)
        else if (message.type === 'peer-left') events.peerLeft(message.peerId)
        else if (message.type === 'signal') events.signal(message.peerId, peerDescription(message.description))
        else throw new Error('Unexpected signaling message')
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Invalid signaling message')
      }
    })
    socket.addEventListener('error', () => fail('Friend service is unavailable. Offline play remains available.'))
    socket.addEventListener('close', () => fail('Invitation service disconnected. Existing peer links can continue.'))
  })
}
