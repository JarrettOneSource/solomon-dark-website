import { join, resolve } from 'node:path'
import { startRuntimeService } from './runtime-service.mjs'

export async function startLocalGameHost({ applicationRoot, origin, credential, onExit }) {
  const entry = resolve(process.env.SDR_DESKTOP_GAME_HOST || join(applicationRoot, 'game-host', 'game-host.mjs'))
  const service = await startRuntimeService({
    applicationRoot, entry, onExit,
    environment: {
      SDR_GAME_ALLOWED_ORIGINS: origin,
      SDR_GAME_BOOTSTRAP_CREDENTIAL: credential,
      SDR_GAME_HOST: '127.0.0.1',
      SDR_GAME_PORT: '0',
      SDR_GAME_SNAPSHOT_RATE: '20',
    },
    validate(message) {
      const url = typeof message.url === 'string' ? new URL(message.url) : null
      if (url?.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.pathname !== '/game' || url.username || url.password) {
        throw new Error('Local game host emitted invalid readiness data')
      }
      return { kind: 'localhost', sessionKind: 'standalone', url: message.url, credential }
    },
  })
  return { endpoint: service.ready, pid: service.pid, close: service.close }
}
