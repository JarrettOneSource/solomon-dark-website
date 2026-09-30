export function peerIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error('Invalid peer connection configuration')
  return value.map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid connection server')
    const urls: unknown[] = Array.isArray(entry.urls) ? entry.urls : [entry.urls]
    if (urls.length === 0 || urls.length > 8 || !urls.every(url => typeof url === 'string'
      && url.length <= 512 && /^(stun|stuns|turn|turns):/.test(url))) {
      throw new Error('Invalid connection server address')
    }
    if (entry.username !== undefined && (typeof entry.username !== 'string' || entry.username.length > 256)) {
      throw new Error('Invalid relay username')
    }
    if (entry.credential !== undefined && (typeof entry.credential !== 'string' || entry.credential.length > 512)) {
      throw new Error('Invalid relay credential')
    }
    return { urls: urls as string[], ...(entry.username ? { username: entry.username } : {}),
      ...(entry.credential ? { credential: entry.credential } : {}) }
  })
}

export function peerDescription(value: unknown): RTCSessionDescriptionInit {
  if (!value || typeof value !== 'object') throw new Error('Invalid peer description')
  const entry = value as Record<string, unknown>
  if ((entry.type !== 'offer' && entry.type !== 'answer')
    || typeof entry.sdp !== 'string' || entry.sdp.length > 64 * 1024) throw new Error('Invalid peer description')
  return { type: entry.type, sdp: entry.sdp }
}

export async function gatherPeerDescription(
  pc: RTCPeerConnection,
  description: RTCSessionDescriptionInit,
): Promise<RTCSessionDescriptionInit> {
  await pc.setLocalDescription(description)
  if (pc.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (pc.iceGatheringState === 'complete') { cleanup(); resolve() }
        else if (pc.connectionState === 'closed') { cleanup(); reject(new Error('Peer connection closed')) }
      }
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Network discovery timed out')) }, 15_000)
      const cleanup = () => {
        clearTimeout(timeout)
        pc.removeEventListener('icegatheringstatechange', changed)
        pc.removeEventListener('connectionstatechange', changed)
      }
      pc.addEventListener('icegatheringstatechange', changed)
      pc.addEventListener('connectionstatechange', changed)
      changed()
    })
  }
  if (!pc.localDescription) throw new Error('Peer connection has no local description')
  return { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
}
