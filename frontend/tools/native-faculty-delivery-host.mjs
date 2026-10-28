import { startGameHost } from '../src/game/host/game-host.ts'

const events = []
const host = await startGameHost({
  authentication: { kind: 'shared', credential: process.env.SDR_FACULTY_HOST_CREDENTIAL },
  allowedOrigins: [process.env.SDR_FACULTY_HOST_ORIGIN],
  port: 0,
  snapshotRate: 20,
  log: entry => events.push(entry),
})
let closing = false
async function close() {
  if (closing) return
  closing = true
  await host.close()
  if (process.connected) process.disconnect()
}
process.on('disconnect', () => { void close() })
process.on('message', message => {
  if (message === 'close') { void close(); return }
  if (message !== 'state') throw new Error('Unknown Faculty acceptance request')
  const state = host.state()
  process.send({
    players: host.humanPlayerCount(),
    effects: state.world.kind === 'boneyard' ? state.world.enemies.deathEffects.length : null,
    events,
    tick: state.tick,
  })
})
process.send({ url: host.address.url })
