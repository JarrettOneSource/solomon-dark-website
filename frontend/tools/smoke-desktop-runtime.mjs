import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { availableParallelism, freemem, totalmem, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { _electron as electron } from 'playwright-core'

const applicationPath = resolve(process.env.SDR_DESKTOP_APP || `dist-desktop/Solomon Darker-${process.platform}-${process.arch}`)
const manifest = JSON.parse(await readFile(join(applicationPath, 'desktop-package-manifest.json'), 'utf8'))
const executable = resolve(applicationPath, manifest.executable)
const evidence = resolve(process.env.SDR_DESKTOP_EVIDENCE || 'reports/desktop-smoke')
await mkdir(evidence, { recursive: true })
const profiles = await mkdtemp(join(tmpdir(), 'solomon-darker-smoke-'))
await writeFile(join(profiles, 'SwiftShader.ini'), '[Processor]\nThreadCount=1\n')
const running = new Set()
const errors = []
const receipts = { platform: process.platform, revision: manifest.revision }
const startedAt = Date.now()
const step = label => console.log(JSON.stringify({ step: label, elapsedMs: Date.now() - startedAt, cores: availableParallelism(), freeMemory: freemem(), totalMemory: totalmem() }))
step('start')

try {
  const solo = await launch('solo', join(profiles, 'solo'))
  await solo.page.screenshot({ path: join(evidence, 'launcher.png') })
  await solo.page.getByRole('button', { name: 'Play offline' }).click()
  console.log('Solo requested')
  await enterHub(solo.page, 'Offline Wizard', 'Fire')
  console.log('Solo entered Hub')
  const runtime = await solo.page.evaluate(() => ({
    origin: location.origin,
    endpoint: window.solomonDarkRuntime.gameEndpoint,
  }))
  assert.equal(runtime.origin, 'solomon-darker://app')
  assert.equal(runtime.endpoint.kind, 'localhost')
  assert.equal(runtime.endpoint.sessionKind, 'standalone')
  const child = await hostProcess(solo.app)
  assert.ok(child.executable.toLowerCase().includes('runtime'), JSON.stringify(child))
  assert.equal(child.command.includes(runtime.endpoint.credential), false)
  const movement = await move(solo.page)
  await solo.page.evaluate(() => localStorage.setItem('desktop-smoke-settings', 'retained'))
  await solo.page.screenshot({ path: join(evidence, 'solo.png') })
  const updateStatus = await solo.page.evaluate(() => window.solomonDarkRuntime.desktop.checkUpdates())
  assert.equal(updateStatus.update, null)
  assert.ok(updateStatus.updateError, 'the disabled external network must fail only the optional update check')
  await close(solo)
  await waitForExit(child.pid)

  const resumed = await launch('resume', join(profiles, 'solo'))
  await resumed.page.getByRole('button', { name: 'Play offline' }).click()
  await title(resumed.page)
  assert.equal(await resumed.page.evaluate(() => localStorage.getItem('desktop-smoke-settings')), 'retained')
  const save = await readSave(resumed.page)
  assert.ok(save.position.x > movement.before + 10, JSON.stringify({ save, movement }))
  await resumed.page.getByRole('button', { name: 'Play', exact: true }).click()
  await resumed.page.getByRole('button', { name: 'Last game', exact: true }).click()
  await readyHub(resumed.page)
  const restored = await hubFrame(resumed.page)
  assert.ok(restored.playerX > movement.before + 10, JSON.stringify({ restored, movement }))
  await resumed.page.screenshot({ path: join(evidence, 'resumed.png') })
  receipts.updatePrompt = await proveUpdatePrompt(resumed)
  console.log('Offline save resumed; update prompt dismissed')
  receipts.offline = { movement, savedPosition: save.position, resumedX: restored.playerX, origin: runtime.origin, bundledHostExited: true, updateCheckFailedWithoutBlockingPlay: true }
  await close(resumed)

  const host = await launch('host', join(profiles, 'host'))
  const port = await freePort()
  await host.page.getByLabel('Your reachable IP or hostname').fill('127.0.0.1')
  await host.page.getByLabel('TCP port').fill(String(port))
  await host.page.getByRole('button', { name: 'Host game', exact: true }).click()
  await enterHub(host.page, 'Peer Host', 'Fire')
  console.log('Peer host entered Hub')
  step('host process lookup start')
  const hostChild = await hostProcess(host.app)
  step('host process lookup end')
  const invitation = await host.app.evaluate(({ Menu, clipboard }) => {
    const item = Menu.getApplicationMenu().items.find(row => row.label === 'Game').submenu.items.find(row => row.label === 'Copy multiplayer invite')
    item.click()
    return clipboard.readText()
  })
  step('host invite copied')
  const guest = await launch('guest', join(profiles, 'guest'))
  await guest.page.getByLabel('Multiplayer invite').fill(invitation)
  await guest.page.getByRole('button', { name: 'Join game', exact: true }).click()
  await enterHub(guest.page, 'Peer Guest', 'Air')
  console.log('Peer guest entered Hub')
  for (const player of [host, guest]) {
    await player.page.waitForFunction(() => document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === 2)
  }
  const hostHub = await hubFrame(host.page)
  const guestHub = await hubFrame(guest.page)
  assert.notEqual(hostHub.localPlayerId, guestHub.localPlayerId)
  assert.equal(hostHub.hostPlayerId, hostHub.localPlayerId)
  assert.equal(guestHub.hostPlayerId, hostHub.localPlayerId)
  const guestMovement = await move(guest.page)
  await host.page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  for (const player of [host, guest]) {
    await player.page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
    await player.page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === 2)
    await player.page.locator('.gameplay-resume-progress-overlay').waitFor({ state: 'detached', timeout: 30_000 })
  }
  await host.page.screenshot({ path: join(evidence, 'peer-host-boneyard.png') })
  await guest.page.screenshot({ path: join(evidence, 'peer-guest-boneyard.png') })
  receipts.peer = { hostPlayer: hostHub.localPlayerId, guestPlayer: guestHub.localPlayerId, guestMovement, sharedBoneyardPlayers: 2 }
  console.log('Both peers entered the Boneyard')
  await close(guest)
  await close(host)
  await waitForExit(hostChild.pid)
  assert.deepEqual(errors, [])
  await writeFile(join(evidence, 'receipt.json'), `${JSON.stringify({ status: 'ok', ...receipts }, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ status: 'ok', ...receipts, evidence })}\n`)
} catch (error) {
  process.stderr.write(`${error.stack}\n`)
  for (const instance of running) {
    await instance.page.screenshot({ path: join(evidence, `${instance.label}-failure.png`) }).catch(() => {})
    const body = await instance.page.locator('body').innerText().catch(() => '')
    process.stderr.write(`${JSON.stringify({ label: instance.label, url: instance.page.url(), body: body.slice(0, 2500), errors })}\n`)
  }
  throw error
} finally {
  for (const instance of running) {
    const timeout = setTimeout(() => {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/PID', String(instance.app.process().pid), '/T', '/F']) } catch {}
      } else instance.app.process().kill('SIGKILL')
    }, 25_000)
    await instance.app.close().catch(() => {})
    clearTimeout(timeout)
  }
  await rm(profiles, { recursive: true, force: true })
}

async function launch(label, userData) {
  step(`${label} launch start`)
  const app = await electron.launch({
    executablePath: executable,
    cwd: profiles,
    args: [
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--use-gl=angle',
      // Chromium's proxy applies to update checks too; loopback retains its native bypass.
      '--proxy-server=http://127.0.0.1:9',
    ],
    env: { ...process.env, SDR_DESKTOP_USER_DATA: userData, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 30_000,
  })
  step(`${label} launch connected`)
  app.process().stderr.on('data', chunk => process.stderr.write(`${label} main: ${chunk}`))
  app.context().setDefaultTimeout(30_000)
  const page = await app.firstWindow({ timeout: 30_000 })
  const instance = { app, page, label }
  running.add(instance)
  page.on('requestfailed', request => process.stderr.write(`${label} request: ${request.url()} ${request.failure()?.errorText}\n`))
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('ERR_PROXY_CONNECTION_FAILED')) {
      process.stderr.write(`${label}: ${message.text()}\n`)
    }
  })
  await page.getByRole('button', { name: 'Play offline' }).waitFor({ timeout: 30_000 })
  return instance
}

async function title(page) {
  const play = page.getByRole('button', { name: 'Play', exact: true })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  await play.or(tutorial).first().waitFor({ timeout: 90_000 })
  if (await tutorial.isVisible()) {
    await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorial.waitFor({ state: 'detached' })
  }
  await play.waitFor({ timeout: 30_000 })
}

async function enterHub(page, name, element) {
  await title(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 45_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(name)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await readyHub(page)
}

async function readyHub(page) {
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 60_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.dataset.hubRegion === 'courtyard' && canvas?.dataset.transitionPhase === 'none'
  })
}

async function hubFrame(page) {
  return page.locator('.hub-world-canvas').evaluate(canvas => ({
    playerX: canvas.__sdrHubFrame.playerX,
    hostPlayerId: canvas.__sdrHubFrame.hostPlayerId,
    localPlayerId: canvas.__sdrHubFrame.localPlayerId,
  }))
}

async function move(page) {
  await page.bringToFront()
  await page.locator('.hub-scene').focus()
  const before = (await hubFrame(page)).playerX
  await page.keyboard.down('d')
  try {
    // Software-rendered CI can run at 2 FPS; wait for movement, not a fixed key duration.
    await page.waitForFunction(initial => document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerX > initial + 10, before, { timeout: 15_000 })
  } finally { await page.keyboard.up('d') }
  await delay(200)
  const after = (await hubFrame(page)).playerX
  assert.ok(after > before + 10, JSON.stringify({ before, after }))
  return { before, after }
}

async function readSave(page) {
  return page.evaluate(() => new Promise((resolveSave, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots').objectStore('slots').get(0)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const stored = request.result
        const document = JSON.parse(stored.document)
        resolveSave({ revision: stored.revision, position: document.continuation.simulation.playerEntities.locomotions[0].position })
        open.result.close()
      }
    }
  }))
}

async function hostProcess(application) {
  step('child lookup start')
  const parent = await application.evaluate(() => process.pid)
  if (process.platform === 'win32') {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${parent}" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`], { encoding: 'utf8' })
    step('child lookup CIM complete')
    const value = JSON.parse(raw)
    const host = (Array.isArray(value) ? value : [value]).find(child => child.CommandLine?.includes('game-host.mjs'))
    assert.ok(host, 'the packaged app must own a separate Node host')
    return { pid: host.ProcessId, executable: host.ExecutablePath, command: host.CommandLine }
  }
  const lines = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).split('\n')
  const child = lines.map(line => /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)).find(parts => parts && Number(parts[2]) === parent && parts[3].includes('game-host.mjs'))
  assert.ok(child, 'the packaged app must own a separate Node host')
  return { pid: Number(child[1]), executable: child[3], command: child[3] }
}

async function proveUpdatePrompt(instance) {
  const revision = 'f'.repeat(40)
  await instance.app.evaluate(({ net }, fixture) => {
    const original = net.fetch.bind(net)
    const base = `https://github.com/JarrettOneSource/solomon-dark-website/releases/download/desktop-${fixture.revision}`
    net.fetch = (url, options) => {
      if (url === 'https://api.github.com/repos/JarrettOneSource/solomon-dark-website/releases/latest') {
        return Promise.resolve(Response.json({
          tag_name: `desktop-${fixture.revision}`, draft: false, prerelease: false,
          assets: ['desktop-release.json', `Solomon-Darker-${process.platform}-${process.arch}.zip`].map(name => ({ name, browser_download_url: `${base}/${name}` })),
        }))
      }
      if (url === `${base}/desktop-release.json`) {
        net.fetch = original
        return Promise.resolve(Response.json({ schemaVersion: 1, revision: fixture.revision, sourceTimestamp: fixture.sourceTimestamp }))
      }
      return original(url, options)
    }
  }, { revision, sourceTimestamp: manifest.sourceTimestamp + 1 })
  const offered = await instance.page.evaluate(() => window.solomonDarkRuntime.desktop.checkUpdates())
  assert.equal(offered.update.revision, revision)
  const notice = instance.page.locator('.desktop-update-notice')
  await notice.getByRole('button', { name: 'Download update' }).waitFor()
  await instance.page.screenshot({ path: join(evidence, 'update-prompt.png') })
  await notice.getByRole('button', { name: 'Later' }).click()
  await notice.waitFor({ state: 'detached' })
  assert.equal(await instance.page.locator('.hub-world-canvas').count(), 1)
  return { shown: true, dismissedWithoutRestart: true }
}

async function close(instance) {
  let timeout
  try {
    await Promise.race([
      instance.app.close(),
      new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error(`${instance.label} did not close after saving.`)), 30_000) }),
    ])
  } finally { clearTimeout(timeout) }
  running.delete(instance)
}

async function waitForExit(pid) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { process.kill(pid, 0) } catch (error) { if (error.code === 'ESRCH') return; throw error }
    await delay(100)
  }
  throw new Error(`The packaged host ${pid} was not reaped.`)
}

async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise(resolveClose => server.close(resolveClose))
  return port
}
