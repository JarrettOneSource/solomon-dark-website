import assert from 'node:assert/strict'
import { readFile, readlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { _electron as electron } from 'playwright-core'

const applicationPath = resolve(
  process.env.SDR_DESKTOP_APP || 'dist-desktop/Solomon Dark-linux-x64',
)
const manifest = JSON.parse(await readFile(join(applicationPath, 'desktop-package-manifest.json'), 'utf8'))
assert.equal(manifest.executable, 'solomon-dark')
const executable = resolve(applicationPath, manifest.executable)
const pageErrors = []
const consoleErrors = []
const application = await electron.launch({
  args: [
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--use-gl=angle',
  ],
  executablePath: executable,
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
})
let hostPid
try {
  const page = await application.firstWindow({ timeout: 30_000 })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const runtime = await page.evaluate(() => ({
    endpoint: window.solomonDarkRuntime?.gameEndpoint,
    origin: window.location.origin,
  }))
  assert.equal(runtime.endpoint.kind, 'localhost')
  const endpoint = new URL(runtime.endpoint.url)
  assert.equal(endpoint.protocol, 'ws:')
  assert.equal(endpoint.hostname, '127.0.0.1')
  assert.match(runtime.origin, /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.ok(runtime.endpoint.credential.length >= 32)
  const health = await page.evaluate(async () => (await fetch('/__desktop/health')).json())
  assert.deepEqual(health, { status: 'ok' })

  const descendants = await processTable()
  const host = descendants.find((process) => process.command.includes('game-host/hub-host.mjs'))
  assert.ok(host, `expected a separate authoritative Node host:\n${JSON.stringify(descendants)}`)
  hostPid = host.pid
  const hostExecutable = await readlink(`/proc/${hostPid}/exe`)
  assert.equal(hostExecutable, join(applicationPath, 'resources', 'app', 'runtime', 'node'))
  assert.ok(
    descendants.every((process) => !process.command.includes(runtime.endpoint.credential)),
    'credential must not be exposed in any process command line',
  )

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /Ether/ }).click()
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
  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  await page.keyboard.down('d')
  await page.waitForTimeout(700)
  await page.keyboard.up('d')
  await page.waitForTimeout(150)
  const after = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(after > before, `expected standalone authoritative movement (${before} -> ${after})`)
  assert.match(await canvas.getAttribute('data-renderer-name') ?? '', /webgl/i)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])

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
  await assert.rejects(readFile(`/proc/${hostPid}/status`), /ENOENT/)
}

async function processTable() {
  const parentPid = application.process().pid
  const result = await import('node:child_process').then(({ execFile }) => new Promise((resolveExec, reject) => {
    execFile('ps', ['-eo', 'pid=,ppid=,args='], (error, stdout) => error ? reject(error) : resolveExec(stdout))
  }))
  const rows = result.trim().split('\n').map((line) => {
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
