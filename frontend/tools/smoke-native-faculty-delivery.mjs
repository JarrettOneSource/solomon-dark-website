import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { createNativeFacultyDeathSaveFixture } from './native-faculty-save-fixture.ts'

const output = process.env.SDR_FACULTY_DELIVERY_OUTPUT || '/tmp/solomon-faculty-delivery'
await mkdir(output, { recursive: true })
const fixture = createNativeFacultyDeathSaveFixture(3)
const save = createGameSaveDocument(fixture)
const credential = randomBytes(32).toString('base64url')
const errors = []
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)), port: 0 })
// Keep browser-driver parsing and GC off the authoritative simulation thread,
// matching the separate-process endurance runtime and production host.
const host = fork(fileURLToPath(new URL('./native-faculty-delivery-host.mjs', import.meta.url)), [], {
  execArgv: ['--experimental-strip-types'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  env: { ...process.env, SDR_FACULTY_HOST_CREDENTIAL: credential, SDR_FACULTY_HOST_ORIGIN: server.origin },
})
const hostExited = new Promise(resolve => host.once('exit', (code, signal) => resolve({ code, signal })))
const ready = await hostReply()
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const contexts = []
const pages = []
try {
  for (const [index, element] of ['fire', 'ether'].entries()) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    contexts.push(context)
    const page = await context.newPage()
    pages.push(page)
    page.on('pageerror', error => errors.push({ index, kind: 'page', message: error.message }))
    page.on('console', message => { if (message.type() === 'error') errors.push({ index, kind: 'console', message: message.text() }) })
    page.on('response', response => { if (response.status() >= 400) errors.push({ index, kind: 'response', status: response.status(), url: response.url() }) })
    page.on('requestfailed', request => errors.push({ index, kind: 'request', url: request.url(), message: request.failure()?.errorText }))
    await page.addInitScript(({ credential, url, save }) => {
      window.solomonDarkRuntime = { gameEndpoint: { credential, kind: 'localhost', sessionKind: 'standalone', url } }
      window.__burst = { snapshots: [], frames: 0, previousAt: null, maximumGapMs: 0 }
      const Original = window.WebSocket
      window.WebSocket = new Proxy(Original, { construct(Target, args) {
        const socket = new Target(...args)
        socket.addEventListener('message', event => {
          if (typeof event.data !== 'string') return
          const prefix = event.data.slice(0, 100)
          if (prefix.includes('"type":"server-gameplay-pause"')
            || prefix.includes('"type":"server-gameplay-resume-grace"')) {
            window.__burst.previousAt = null
            return
          }
          if (prefix.includes('"type":"server-snapshot"')) {
            const now = performance.now()
            const active = document.querySelector('.boneyard-scene')?.getAttribute('data-gameplay-input-blocked') === 'false'
            const probe = window.__burst
            if (active && probe.previousAt !== null) probe.maximumGapMs = Math.max(probe.maximumGapMs, now - probe.previousAt)
            probe.previousAt = active ? now : null
            probe.snapshots.push({ atMs: now, active, bytes: event.data.length })
          }
        })
        const send = socket.send.bind(socket)
        socket.send = data => {
          if (save && typeof data === 'string' && data.includes('"type":"client-hello"')) {
            const message = JSON.parse(data)
            delete message.beginCollegeIntro; delete message.declineTutorial; delete message.resumeToken
            return send(JSON.stringify({ ...message, save, saveIntent: 'resume',
              character: { discipline: 'arcane', element: 'fire', displayName: 'Faculty save regression' } }))
          }
          return send(data)
        }
        return socket
      } })
      const frame = () => { window.__burst.frames += 1; requestAnimationFrame(frame) }
      requestAnimationFrame(frame)
    }, { credential, url: ready.url, save: index === 0 ? save : null })
    await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90000 })
    const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
    if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
    await page.locator('.create-menu-discipline-arcane').click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90000 })
    if (index === 0) {
      await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })
      await page.keyboard.press('Escape')
      await page.locator('[data-gameplay-pause-source="pause-menu"]').waitFor({ state: 'visible', timeout: 30000 })
    }
  }
  const shared = await hostState()
  assert.equal(shared.players, 2)
  const sharedPopulation = shared.effects
  assert.ok(sharedPopulation > 25000, 'both peers must join before the native burst decays')
  await pages[0].getByRole('button', { name: /^resume game$/i }).click()
  await Promise.all(pages.map(page => page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })))
  await new Promise(resolve => setTimeout(resolve, 18000))
  const clients = await Promise.all(pages.map(page => page.evaluate(() => ({
    ...window.__burst, playerCount: document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount,
    effects: document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.enemyDeathEffectCount,
  }))))
  const final = await hostState()
  const events = final.events
  const receipt = { initialPopulation: fixture.state.world.enemies.deathEffects.length,
    sharedPopulation, finalPopulation: final.effects, clients, errors, events }
  await writeFile(output + '/result.json', JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify({ ...receipt, events: events.filter(e => /flow_control|tick_lag/.test(e.event)),
    clients: clients.map(c => ({ ...c, snapshots: c.snapshots.length })) }))
  assert.deepEqual(errors, [])
  assert.equal(receipt.finalPopulation, 0, 'native death effects must retire')
  for (const client of clients) {
    assert.equal(client.playerCount, 2)
    assert.equal(client.effects, 0)
    assert.ok(client.frames > 300, 'each browser must keep rendering')
    assert.ok(client.snapshots.filter(row => row.active).length > 100, 'each browser must receive active snapshots')
    assert.ok(client.maximumGapMs < 1000, 'active delivery exceeds 1000 ms')
  }
} catch (error) {
  await writeFile(output + '/failure.json', JSON.stringify({
    error: String(error), errors, host: await hostState(),
    clients: await Promise.all(pages.map(page => page.evaluate(() => ({
      text: document.body.innerText,
      scene: { ...document.querySelector('.boneyard-scene')?.dataset },
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
    })))),
  }, null, 2))
  throw error
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
  if (host.connected) host.send('close')
  const deadline = setTimeout(() => host.kill('SIGKILL'), 5000)
  try { await hostExited } finally { clearTimeout(deadline) }
  await server.close()
}

function hostReply() {
  return Promise.race([
    once(host, 'message').then(([message]) => message),
    hostExited.then(result => { throw new Error(`Faculty host exited early: ${JSON.stringify(result)}`) }),
  ])
}

function hostState() {
  const reply = hostReply()
  host.send('state')
  return reply
}
