import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const READINESS_TIMEOUT_MS = 12_000
const SHUTDOWN_TIMEOUT_MS = 3_000

export async function startRuntimeService({ applicationRoot, entry, environment = {}, configuration, validate, onExit }) {
  const trace = label => console.error(JSON.stringify({ time: Date.now(), parent: process.pid, entry: basename(entry), label }))
  trace('service requested')
  const node = resolve(process.env.SDR_DESKTOP_NODE || join(applicationRoot, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'))
  await Promise.all([access(node), access(entry)])
  const child = spawn(node, [entry], {
    env: {
      ...(process.platform === 'win32' && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  })
  trace(`spawn returned pid ${child.pid}`)
  child.once('spawn', () => trace('spawn event'))
  child.stderr.on('data', chunk => console.error(`service ${child.pid}: ${chunk}`))
  let stopping = false
  try {
    const readiness = hostReadiness(child, validate)
    if (configuration !== undefined) child.send(configuration, error => trace(`IPC sent ${error?.message || 'ok'}`))
    const ready = await readiness
    trace('ready received')
    child.once('exit', (code, signal) => { if (!stopping) onExit(code ?? signal) })
    return {
      ready,
      pid: child.pid,
      async close() {
        stopping = true
        await stopChild(child)
      },
    }
  } catch (error) {
    await stopChild(child)
    throw error
  }
}

function hostReadiness(child, validate) {
  return new Promise((resolveReady, reject) => {
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => fail(new Error('Desktop service readiness timed out')), READINESS_TIMEOUT_MS)
    const receive = (chunk) => {
      stdout += chunk
      if (stdout.length > 64 * 1024) {
        fail(new Error('Desktop service emitted excessive readiness output'))
        return
      }
      const newline = stdout.indexOf('\n')
      if (newline < 0) return
      try {
        const message = JSON.parse(stdout.slice(0, newline))
        if (message.type === 'error' && typeof message.message === 'string') throw new Error(message.message)
        if (message.type !== 'ready') throw new Error('Desktop service emitted invalid readiness data')
        const ready = validate(message)
        cleanup()
        child.stdout.resume()
        resolveReady(ready)
      } catch (error) {
        fail(error)
      }
    }
    const fail = (error) => {
      cleanup()
      reject(new Error(`${error.message}${stderr ? `: ${stderr.trim()}` : ''}`))
    }
    const exited = (code, signal) => fail(new Error(`Desktop service exited before readiness (${code ?? signal})`))
    const cleanup = () => {
      clearTimeout(timeout)
      child.stdout.off('data', receive)
      child.off('error', fail)
      child.off('exit', exited)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8192) })
    child.stdout.on('data', receive)
    child.once('error', fail)
    child.once('exit', exited)
  })
}

function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolveStop) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, SHUTDOWN_TIMEOUT_MS)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    child.kill('SIGTERM')
  })
}
