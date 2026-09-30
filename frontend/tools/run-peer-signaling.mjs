import { createHmac, randomBytes } from 'node:crypto'
import { startPeerSignaling } from '../desktop/peer-signaling.mjs'

const port = Number(process.env.SDR_PEER_PORT || 5223)
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid SDR_PEER_PORT')
const configuredIce = JSON.parse(process.env.SDR_PEER_ICE_SERVERS_JSON
  || '[{"urls":["stun:stun.cloudflare.com:3478"]}]')
if (!Array.isArray(configuredIce) || configuredIce.length > 7) throw new Error('Invalid SDR_PEER_ICE_SERVERS_JSON')
const turnSecret = process.env.SDR_PEER_TURN_SECRET
const turnUrls = process.env.SDR_PEER_TURN_URLS?.split(',').map(value => value.trim()).filter(Boolean) || []
if (Boolean(turnSecret) !== Boolean(turnUrls.length)) throw new Error('Configure TURN URLs and secret together')
if (turnUrls.length > 8 || turnUrls.some(url => url.length > 512 || !/^turns?:/.test(url))) {
  throw new Error('Invalid SDR_PEER_TURN_URLS')
}
const service = await startPeerSignaling({
  port,
  trustedProxy: process.env.SDR_PEER_TRUSTED_PROXY === '1',
  iceServers: () => {
    if (!turnSecret) return configuredIce
    const username = `${Math.floor(Date.now() / 1000) + 12 * 60 * 60}:${randomBytes(12).toString('hex')}`
    const credential = createHmac('sha1', turnSecret).update(username).digest('base64')
    return [...configuredIce, { urls: turnUrls, username, credential }]
  },
})
console.log(JSON.stringify({ type: 'ready', url: service.url }))
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await service.close()
}
process.once('SIGTERM', () => { void stop() })
process.once('SIGINT', () => { void stop() })
