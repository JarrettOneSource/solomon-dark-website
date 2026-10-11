import { startPeerHost, startPeerJoin } from './peer-network.mjs'
const trace = label => console.error(JSON.stringify({ time: Date.now(), peer: process.pid, label }))
trace('peer module started')
let tick = Date.now()
setInterval(() => { const now = Date.now(); if (now - tick > 1500) trace(`loop delay ${now - tick}`); tick = now }, 1000).unref()

// Electron uses BoringSSL; the bundled Node runtime owns the verified TLS-PSK rail.
let peer
let stopping = false
async function stop() {
  stopping = true
  await peer?.close()
  if (process.connected) process.disconnect()
}
process.once('disconnect', () => { void stop() })
process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })

try {
  const configuration = await new Promise(resolve => process.once('message', resolve))
  trace(`configuration received ${configuration.mode}`)
  peer = configuration.mode === 'host'
    ? await startPeerHost(configuration)
    : await startPeerJoin(configuration)
  trace('peer listening')
  if (stopping) await stop()
  else process.stdout.write(`${JSON.stringify({ type: 'ready', port: peer.port, credential: peer.credential })}\n`)
} catch (error) {
  trace(`failure ${error.message}`)
  const message = error.code === 'EADDRINUSE'
    ? 'That TCP port is already in use. Choose another port.'
    : error.message
  process.stdout.write(`${JSON.stringify({ type: 'error', message })}\n`)
  await stop()
  process.exitCode = 1
}
