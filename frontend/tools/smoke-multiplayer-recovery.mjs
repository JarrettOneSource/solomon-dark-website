// Report 05: isolate acknowledgment starvation from browser rendering through
// the real session supervisor. This is fault injection, not a historical replay.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameSessionSupervisor } from '../src/game/host/game-session-supervisor.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterBoneyard, enterElementHub, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_MULTIPLAYER_RECOVERY_OUTPUT
assert.ok(output, 'SDR_MULTIPLAYER_RECOVERY_OUTPUT is required')
await mkdir(output, { recursive: true })
const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
const events = []
const clients = []
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot', import.meta.url)) })
const adminSecret = randomBytes(32).toString('base64url')
const supervisor = await startGameSessionSupervisor({
  adminSecret, allowedOrigins: [server.origin], snapshotRate: 20,
  log: entry => {
    if (entry.level === 'error') errors.host.push(entry.event)
    if (entry.event.startsWith('replication.')) events.push({ event: entry.event, details: entry.details })
  },
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  for (const element of ['Air', 'Ether']) {
    const response = await fetch(`${supervisor.address.url}/admin/hub/tickets`, {
      method: 'POST', headers: { authorization: `Bearer ${adminSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: { manifestSha256: '0'.repeat(64), mods: [] }, leaderboardUserId: null }),
    })
    assert.equal(response.status, 201)
    const endpoint = await response.json()
    const context = await browser.newContext({ viewport: { width: 1638, height: 921 }, deviceScaleFactor: 1.5625 })
    const page = await context.newPage()
    const client = { page, context, element, snapshots: [], extensions: null }
    clients.push(client)
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
    page.on('websocket', socket => {
      socket.on('socketerror', error => errors.wire.push(String(error)))
      socket.on('framereceived', ({ payload }) => {
        try {
          const message = decodeServerGameMessage(String(payload))
          if (message.type === 'server-error') errors.wire.push(message.message)
          if (message.type === 'server-snapshot') client.snapshots.push({
            at: performance.now(), sequence: message.sequence, tick: message.frame.tick,
          })
        } catch (error) { errors.wire.push(error.message) }
      })
    })
    await page.route('**/deployment.json*', route => route.fulfill({ json: {
      revision: new URL(route.request().url()).searchParams.get('current'),
    } }))
    await page.addInitScript(gameEndpoint => {
      window.solomonDarkRuntime = { gameEndpoint }
      const NativeSocket = window.WebSocket
      const probe = { hold: false, pending: [], socket: null, playerId: null, party: null }
      window.__sdrRecovery = probe
      window.WebSocket = class extends NativeSocket {
        constructor(...args) {
          super(...args)
          this.addEventListener('message', event => {
            const message = JSON.parse(event.data)
            if (message.type === 'server-welcome') { probe.socket = this; probe.playerId = message.playerId }
            if (message.type === 'server-party-state') probe.party = message.state.party
          })
        }
        send(data) {
          if (probe.hold && JSON.parse(data).type === 'client-snapshot-ack') probe.pending.push(data)
          else super.send(data)
        }
      }
    }, { kind: 'localhost', credential: endpoint.credential,
      url: new URL(endpoint.path, supervisor.address.url.replace('http:', 'ws:')).href })
    await enterElementHub(page, server.origin, element)
  }
  const [slow, healthy] = clients
  const peerId = await healthy.page.evaluate(() => window.__sdrRecovery.playerId)
  await slow.page.evaluate(targetPlayerId => window.__sdrRecovery.socket.send(JSON.stringify({
    type: 'client-party-invite', targetPlayerId,
  })), peerId)
  const invitation = healthy.page.locator('[data-party-invitation]')
  await invitation.waitFor()
  await invitation.getByRole('button', { name: /^accept$/i }).click()
  await Promise.all(clients.map(({ page }) => page.waitForFunction(() => (
    window.__sdrRecovery.party?.memberPlayerIds.length === 2
  ))))
  await enterBoneyard(slow.page)
  await Promise.all(clients.map(({ page }) => page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor()))
  await Promise.all(clients.map(({ page }) => page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()))
  for (const client of clients) client.extensions = await client.page.evaluate(() => window.__sdrRecovery.socket.extensions)
  assert.ok(clients.every(client => client.extensions.includes('permessage-deflate')))
  const baseline = await Promise.all(clients.map(client => measure(client, 3000)))
  assert.equal(baseline[0].runId, baseline[1].runId)
  assert.ok(baseline.every(row => row.renderedFrames > 100 && row.tickAdvance > 200))
  await slow.page.evaluate(() => { window.__sdrRecovery.hold = true })
  const held = await Promise.all(clients.map(client => measure(client, 15000)))
  const pending = await slow.page.evaluate(() => window.__sdrRecovery.pending.length)
  assert.ok(pending > 0 && pending <= 8)
  assert.ok(held[0].snapshots <= 8, 'the blocked peer must retain a bounded snapshot window')
  assert.ok(held[0].renderedFrames > 500, 'withholding acknowledgments must not stop rendering')
  assert.ok(held[1].snapshots > 200 && held[1].tickAdvance > 1000, 'the healthy peer must keep receiving the same run')
  assert.ok(events.some(entry => entry.event === 'replication.flow_control_started'))
  const recoveryStart = healthy.snapshots.at(-1).tick
  const releasedAt = performance.now()
  await slow.page.evaluate(() => {
    const probe = window.__sdrRecovery
    probe.hold = false
    for (const data of probe.pending.splice(0)) probe.socket.send(data)
  })
  await waitUntil(() => slow.snapshots.at(-1).tick >= recoveryStart,
    'withheld acknowledgments did not recover', 5000)
  const recoveryLatencyMs = performance.now() - releasedAt
  const recovery = await Promise.all(clients.map(client => measure(client, 3000)))
  assert.ok(recovery.every(row => row.snapshots >= 40 && row.tickAdvance > 200))
  assert.ok(events.some(entry => entry.event === 'replication.flow_control_recovered'))
  const sequenceGaps = slow.snapshots.slice(1).filter((row, index) => row.sequence > slow.snapshots[index].sequence + 1)
  assert.ok(sequenceGaps.length > 0, 'recovery must cross the skipped sequence window')
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [], host: [] })
  for (const client of clients) await client.page.screenshot({ path: `${output}/${client.element}-recovered.png` })
  const receipt = { status: 'ok', browser: browser.version(), holdMs: 15000, pending, recoveryLatencyMs,
    extensions: clients.map(client => client.extensions), baseline, held, recovery, events, errors }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} catch (error) {
  console.error(JSON.stringify({ errors, events }))
  throw error
} finally {
  await Promise.all(clients.map(({ context }) => context.close()))
  await browser.close()
  await supervisor.close()
  await server.close()
}

async function measure(client, duration) {
  const index = client.snapshots.length
  const tick = client.snapshots.at(-1)?.tick ?? 0
  const rendering = await client.page.evaluate(duration => new Promise(resolve => {
    const read = () => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame
    const initial = read().frameCount
    const gaps = []
    let previous = null
    const unsubscribe = window.__sdrGamePresentation.subscribe(now => {
      if (previous !== null) gaps.push(now - previous)
      previous = now
    })
    setTimeout(() => {
      unsubscribe()
      gaps.sort((a, b) => a - b)
      resolve({ renderedFrames: read().frameCount - initial, playerCount: read().playerCount,
        runId: read().runId, frameP99Ms: gaps[Math.ceil(gaps.length * .99) - 1], maximumFrameMs: gaps.at(-1) })
    }, duration)
  }), duration)
  assert.equal(rendering.playerCount, 2)
  return { element: client.element, ...rendering, snapshots: client.snapshots.length - index,
    tickAdvance: (client.snapshots.at(-1)?.tick ?? tick) - tick }
}
