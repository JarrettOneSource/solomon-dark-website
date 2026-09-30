import { randomBytes } from 'node:crypto'

export function createPeerRooms({ send, iceServers, maxRooms = 128, maxGuests = 7 }) {
  const rooms = new Map()
  function retire(room) {
    if (!rooms.delete(room.code)) return
    for (const guest of room.guests.values()) {
      guest.room = null
      send(guest, { type: 'host-left' })
      guest.ws.close(1000, 'Invitation closed')
    }
    room.host.room = null
    room.guests.clear()
  }
  return {
    receive(peer, message) {
      if (!message || typeof message !== 'object') throw new Error('Invalid signaling message')
      if (message.type === 'host' || message.type === 'join') {
        if (peer.room) throw new Error('Already admitted; reconnect to choose another room')
        if (!Number.isInteger(message.protocol) || message.protocol < 1 || message.protocol > 100_000
          || typeof message.revision !== 'string' || !/^[a-f0-9]{40}$/.test(message.revision)) {
          throw new Error('Invalid game build')
        }
        const ice = typeof iceServers === 'function' ? iceServers() : iceServers
        if (message.type === 'host') {
          if (rooms.size >= maxRooms) throw new Error('Friend service is at capacity; try again later')
          const code = randomBytes(24).toString('base64url')
          const room = {
            code, host: peer, guests: new Map(),
            protocol: message.protocol, revision: message.revision,
            expires: Date.now() + 12 * 60 * 60 * 1000,
          }
          rooms.set(code, room)
          peer.room = room
          peer.id = 'host'
          send(peer, { type: 'hosted', code, iceServers: ice })
          return
        }
        const room = typeof message.code === 'string' && /^[A-Za-z0-9_-]{32}$/.test(message.code)
          ? rooms.get(message.code) : null
        if (!room || room.expires <= Date.now()) throw new Error('That invitation is expired or unavailable')
        if (room.protocol !== message.protocol || room.revision !== message.revision) {
          throw new Error('Both players must use the same game build. Check for updates and try again.')
        }
        if (room.guests.size >= maxGuests) throw new Error('This host already has the maximum number of friends')
        peer.room = room
        peer.id = randomBytes(12).toString('hex')
        room.guests.set(peer.id, peer)
        send(peer, { type: 'joined', peerId: peer.id, iceServers: ice })
        send(room.host, { type: 'peer-joined', peerId: peer.id })
        return
      }
      if (!peer.room) throw new Error('Join or host a room before signaling')
      if (message.type !== 'signal') throw new Error('Unknown signaling message')
      const description = message.description
      if (!description || !['offer', 'answer'].includes(description.type)
        || typeof description.sdp !== 'string' || description.sdp.length > 64 * 1024) {
        throw new Error('Invalid peer description')
      }
      const target = peer.id === 'host' ? peer.room.guests.get(message.peerId)
        : message.peerId === 'host' ? peer.room.host : null
      if (!target) throw new Error('Peer is not in this room')
      send(target, { type: 'signal', peerId: peer.id, description: { type: description.type, sdp: description.sdp } })
    },
    drop(peer) {
      const room = peer.room
      if (!room) return
      if (peer.id === 'host') retire(room)
      else {
        room.guests.delete(peer.id)
        send(room.host, { type: 'peer-left', peerId: peer.id })
      }
      peer.room = null
    },
    expire() {
      for (const room of rooms.values()) {
        if (room.expires <= Date.now()) {
          retire(room)
          room.host.ws.close(1000, 'Invitation expired')
        }
      }
    },
  }
}
