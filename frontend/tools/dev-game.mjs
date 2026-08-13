import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontendRoot = new URL('../', import.meta.url)
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const viteArguments = process.argv.slice(2)
const viteHost = argumentValue(viteArguments, '--host') || 'localhost'
const vitePort = argumentValue(viteArguments, '--port') || '5173'
const configuredOrigin = process.env.SDR_GAME_DEV_ORIGIN?.trim()
const browserOrigin = configuredOrigin || `http://${normalizeBrowserHost(viteHost)}:${vitePort}`
if (isWildcardHost(viteHost) && !configuredOrigin) {
  process.stderr.write(
    'A LAN-visible Vite host needs SDR_GAME_DEV_ORIGIN set to the exact browser origin.\n',
  )
  process.exitCode = 1
  process.exit()
}
const host = spawn(
  process.execPath,
  ['--experimental-strip-types', 'src/game/host/run-game-host.ts'],
  {
    cwd: frontendRoot,
    env: {
      ...process.env,
      SDR_GAME_BOOTSTRAP_CREDENTIAL: credential,
      SDR_GAME_HOST: '127.0.0.1',
      SDR_GAME_PORT: '0',
      SDR_GAME_SNAPSHOT_RATE: '100',
      SDR_GAME_ALLOWED_ORIGINS: browserOrigin,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
)

let buffer = ''
let vite
let stopping = false
host.stdout.setEncoding('utf8')
host.stdout.on('data', (chunk) => {
  buffer += chunk
  const newline = buffer.indexOf('\n')
  if (newline < 0 || vite) return
  let message
  try {
    message = JSON.parse(buffer.slice(0, newline))
  } catch (error) {
    process.stderr.write(`Game host emitted invalid readiness JSON: ${String(error)}\n`)
    void stop(1)
    return
  }
  if (message.type !== 'ready' || typeof message.url !== 'string') {
    process.stderr.write('Game host emitted an invalid readiness message.\n')
    void stop(1)
    return
  }
  process.stdout.write(`Authoritative game host ready at ${message.url}\n`)
  vite = spawn(
    process.execPath,
    [viteEntry, ...viteArguments],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_GAME_SERVER_URL: message.url,
        VITE_GAME_BOOTSTRAP_CREDENTIAL: credential,
      },
      stdio: 'inherit',
    },
  )
  vite.once('exit', (code, signal) => {
    if (!stopping) void stop(code ?? (signal ? 1 : 0))
  })
})

host.once('exit', (code, signal) => {
  if (!stopping) {
    process.stderr.write(`Game host exited unexpectedly (${code ?? signal ?? 'unknown'}).\n`)
    void stop(1)
  }
})

process.once('SIGINT', () => { void stop(0) })
process.once('SIGTERM', () => { void stop(0) })

async function stop(exitCode) {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  await Promise.all([
    terminate(vite),
    terminate(host),
  ])
}

function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const deadline = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, 3000)
    child.once('exit', () => {
      clearTimeout(deadline)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

function argumentValue(arguments_, name) {
  const index = arguments_.indexOf(name)
  if (index < 0) return undefined
  const value = arguments_[index + 1]
  return value && !value.startsWith('-') ? value : undefined
}

function normalizeBrowserHost(hostname) {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname
}

function isWildcardHost(hostname) {
  return hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]'
}
