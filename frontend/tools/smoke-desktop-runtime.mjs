import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { _electron as electron } from 'playwright-core'

const applicationPath = resolve(
  process.env.SDR_DESKTOP_APP || `dist-desktop/${process.platform === 'darwin' ? 'mac-arm64' : process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'}`,
)
const resources = process.platform === 'darwin'
  ? join(applicationPath, 'Solomon Darker.app', 'Contents', 'Resources') : join(applicationPath, 'resources')
const manifest = JSON.parse(await readFile(join(resources, 'desktop-package-manifest.json'), 'utf8'))
const executable = resolve(applicationPath, manifest.executable)
const userData = await mkdtemp(join(tmpdir(), 'solomon-desktop-smoke-'))
await mkdir('reports/desktop', { recursive: true })
const pageErrors = []
const consoleErrors = []
const application = await electron.launch({
  args: process.platform === 'linux' ? [
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--use-gl=angle',
  ] : [],
  executablePath: executable,
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    SDR_DESKTOP_SKIP_UPDATE_CHECK: '1',
    SDR_DESKTOP_USER_DATA: userData,
  },
})
let hostPid
let savedCheckpoint
try {
  const page = await application.firstWindow({ timeout: 30_000 })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  await page.locator('[data-prompt-kind="tutorial"]').getByRole('button').last().click()
  const runtime = await page.evaluate(() => ({
    endpoint: window.solomonDarkRuntime?.gameEndpoint,
    origin: window.location.origin,
  }))
  assert.equal(runtime.endpoint.kind, 'localhost')
  const endpoint = new URL(runtime.endpoint.url)
  assert.equal(endpoint.protocol, 'ws:')
  assert.equal(endpoint.hostname, '127.0.0.1')
  assert.equal(runtime.origin, 'sdr://desktop')
  assert.equal(runtime.endpoint.sessionKind, 'standalone')
  assert.ok(runtime.endpoint.credential.length >= 32)
  const health = await page.evaluate(async () => (await fetch('/__desktop/health')).json())
  assert.deepEqual(health, { status: 'ok' })

  const descendants = await processTable()
  const host = descendants.find((process) => process.command.replaceAll('\\', '/').includes('game-host/game-host.mjs'))
  assert.ok(host, `expected a separate authoritative Node host:\n${JSON.stringify(descendants)}`)
  hostPid = host.pid
  const hostExecutable = join(resources, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
  assert.ok(host.command.includes(hostExecutable), 'the host must execute the bundled Node runtime')
  assert.ok(
    descendants.every((process) => !process.command.includes(runtime.endpoint.credential)),
    'credential must not be exposed in any process command line',
  )

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  const canvas = page.locator('.hub-world-canvas')
  try {
    await canvas.waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2000),
      consoleErrors,
      pageErrors,
      rendererState: await page.locator('.hub-scene').getAttribute('data-renderer-state').catch(() => null),
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-transition-phase') === 'none'
      && !document.querySelector('.match-loading-screen')
  })
  await page.bringToFront()
  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  await page.keyboard.down('d')
  try {
    await page.waitForFunction(before => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerX > before + 10,
      before, { timeout: 10_000 })
  } finally {
    await page.keyboard.up('d')
  }
  await page.waitForTimeout(150)
  const after = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  if (after === before) {
    await page.screenshot({ path: 'reports/desktop/offline-movement-failure.png' })
    console.error(JSON.stringify({
      frame: await canvas.evaluate(node => node.__sdrHubFrame),
      pageState: await page.locator('.main-menu-page').evaluate(node => ({ ...node.dataset })),
      body: (await page.locator('body').innerText()).slice(0, 2200),
      pageErrors,
      consoleErrors,
    }))
  }
  assert.ok(after > before, `expected standalone authoritative movement (${before} -> ${after})`)
  assert.match(await canvas.getAttribute('data-renderer-name') ?? '', /webgl/i)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  savedCheckpoint = await readStoredCheckpoint(page)
  assert.ok(savedCheckpoint?.bytes > 0, 'the authoritative checkpoint must reach the local save store')
  await page.evaluate(async () => {
    localStorage.setItem('desktop-smoke-persisted', 'yes')
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('desktop-smoke-persistence', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('probe')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('probe', 'readwrite')
      transaction.objectStore('probe').put('checkpoint', 'probe')
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    after,
    before,
    electronVersion: manifest.electronVersion,
    hostExecutable,
    hostPid,
    nodeVersion: manifest.nodeRuntime.version,
    origin: runtime.origin,
    renderer: await canvas.getAttribute('data-renderer-name'),
  })}\n`)
} finally {
  await application.close()
}
if (hostPid) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  assert.throws(() => process.kill(hostPid, 0), /ESRCH/)
}
const restarted = await electron.launch({ executablePath: executable, env: {
  ...process.env, SDR_DESKTOP_SKIP_UPDATE_CHECK: '1', SDR_DESKTOP_USER_DATA: userData,
} })
try {
  const page = await restarted.firstWindow()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  assert.deepEqual(await page.evaluate(async () => {
    const stored = await new Promise((resolve, reject) => {
      const request = indexedDB.open('desktop-smoke-persistence', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const get = db.transaction('probe').objectStore('probe').get('probe')
        get.onsuccess = () => { db.close(); resolve(get.result) }
        get.onerror = () => reject(get.error)
      }
    })
    return [location.origin, localStorage.getItem('desktop-smoke-persisted'), stored]
  }), ['sdr://desktop', 'yes', 'checkpoint'])
  assert.deepEqual(await readStoredCheckpoint(page), savedCheckpoint)
  console.log(JSON.stringify({ storageRelaunch: 'ok', actualGameCheckpointPreserved: true }))
} finally {
  await restarted.close()
  await rm(userData, { recursive: true, force: true })
}

async function processTable() {
  const parentPid = application.process().pid
  const result = await import('node:child_process').then(({ execFile }) => new Promise((resolveExec, reject) => {
    const command = process.platform === 'win32' ? 'powershell.exe' : 'ps'
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress']
      : ['-eo', 'pid=,ppid=,args=']
    execFile(command, args, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolveExec(stdout))
  }))
  const rows = process.platform === 'win32'
    ? JSON.parse(result).map(row => ({ pid: row.ProcessId, ppid: row.ParentProcessId, command: row.CommandLine ?? '' }))
    : result.trim().split('\n').map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
    return match ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] } : null
  }).filter(Boolean)
  const descendants = new Set([parentPid])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (descendants.has(row.ppid) && !descendants.has(row.pid)) {
        descendants.add(row.pid)
        changed = true
      }
    }
  }
  return rows.filter((row) => descendants.has(row.pid) && row.pid !== parentPid)
}

async function readStoredCheckpoint(page) {
  return page.evaluate(async () => {
    const record = await new Promise((resolve, reject) => {
      const request = indexedDB.open('solomon-dark-game-saves', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const get = db.transaction('slots').objectStore('slots').getAll()
        get.onsuccess = () => { db.close(); resolve(get.result[0] ?? null) }
        get.onerror = () => reject(get.error)
      }
    })
    if (!record || typeof record.document !== 'string') return null
    const bytes = new TextEncoder().encode(record.document)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return { revision: record.revision, bytes: bytes.length,
      sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') }
  })
}
