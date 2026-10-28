import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { materializeWebSessionContent } from '../src/game/host/web-mod-content.ts'
import { enterElementHub, enterBoneyard, observeGameWire, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_REPORT61_NETWORK_OUTPUT
assert.ok(output && resolve(output).startsWith('/Volumes/Drive/codex-acceptance/solomon-report61-d7634e23/'))
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const content = materializeWebSessionContent({ manifestSha256: '0'.repeat(64), mods: [] })
const tickets = new Map()
const endpointOrigin = 'wss://report61-party-direct.invalid'
const host = await startGameHost({ allowedOrigins: [server.origin],
  authentication: { kind: 'tickets', claim: credential => {
    const admission = tickets.get(credential) ?? null
    tickets.delete(credential)
    return admission
  } },
  leaderboardReceiptSecret: randomBytes(32).toString('base64url'),
  luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
  resetWhenEmpty: true, sharedHub: true, snapshotRate: 20 })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH, headless: true })
const clients = []
const receipts = []
const errors = { console: [], page: [], responses: [], requests: [], wire: [] }
let failure = null
try {
  for (const element of ['Fire', 'Air']) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const client = { context, page, element, id: null, sockets: 0, wire: observeGameWire(page) }
    clients.push(client)
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.requests.push(request.url()) })
    page.on('websocket', socket => { client.sockets++; socket.on('socketerror', error => errors.wire.push(String(error))) })
    // Reuse the existing party-rejoin local provisioning fixture. Endpoint
    // validation still runs; only its declared remote socket address is mapped.
    await context.addInitScript(({ actualUrl, endpointOrigin }) => {
      const NativeWebSocket = window.WebSocket
      window.WebSocket = class extends NativeWebSocket {
        constructor(url, protocols) {
          const requested = new URL(String(url))
          const mapped = requested.origin === endpointOrigin ? actualUrl : requested.toString()
          if (protocols === undefined) super(mapped)
          else super(mapped, protocols)
        }
      }
    }, { actualUrl: host.address.url, endpointOrigin })
    await context.route('**/api/game/hub', route => route.fulfill({ status: 201,
      json: endpoint(issueTicket({ content, leaderboardUserId: null })) }))
    await context.route('**/api/game/run-performance', async route => {
      assert.equal(route.request().method(), 'POST')
      assert.ok(route.request().postDataJSON()?.performance)
      receipts.push({ name: 'local-performance-receipt', element,
        qualification: 'Local backend receipt fixture; no managed-service storage claim' })
      await route.fulfill({ status: 201, json: { logId: randomUUID(), submittedAtUtc: new Date().toISOString() } })
    })
    await context.route('**/api/game/rejoin', async route => {
      const token = route.request().postDataJSON()?.token
      const target = typeof token === 'string' ? host.partyRejoinTarget(token) : null
      assert.ok(target, 'Actual saved party claim must resolve to the retained run')
      assert.equal(target.status, 'detached')
      const reservationId = randomBytes(24).toString('base64url')
      assert.equal(host.reservePartyRejoin(token, reservationId, performance.now() + 30_000), null)
      await route.fulfill({ status: 201, json: endpoint(issueTicket({ content: target.content,
        developerAccess: target.developerAccess, leaderboardUserId: target.leaderboardUserId,
        partyRejoinToken: token, reservationId })) })
    })
    await page.route('**/deployment.json*', route => route.fulfill({ json: {
      revision: new URL(route.request().url()).searchParams.get('current'),
    } }))
    await enterElementHub(page, server.origin, element)
    client.id = await page.locator('.hub-world-canvas').evaluate(node => node.__sdrHubFrame.localPlayerId)
  }
  const [leader, peer] = clients
  assert.notEqual(leader.id, peer.id)
  await leader.page.waitForFunction(id => Boolean(
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerScreenPositions[id]), peer.id)
  // Reuse the public invitation flow from the existing built party journey.
  const canvas = leader.page.locator('.hub-world-canvas')
  const target = await canvas.evaluate((node, id) => ({ width: Number(node.dataset.viewportWidth),
    height: Number(node.dataset.viewportHeight), position: node.__sdrHubFrame.playerScreenPositions[id] }), peer.id)
  const bounds = await canvas.boundingBox()
  assert.ok(bounds && target.position)
  await leader.page.mouse.click(bounds.x + target.position.x * bounds.width / target.width,
    bounds.y + target.position.y * bounds.height / target.height)
  await leader.page.getByRole('button', { name: 'Invite to Party', exact: true }).click()
  await leader.page.getByRole('button', { name: 'Close', exact: true }).click()
  const invitation = peer.page.locator('[data-party-invitation]')
  await invitation.waitFor()
  await invitation.getByRole('button', { name: /^accept$/i }).click()
  await Promise.all(clients.map(client => client.page.waitForFunction(() =>
    document.querySelectorAll('[data-native-ui-party-chip="member"]').length === 2)))
  assert.ok(host.partyCount() > 0)
  assert.equal(host.humanPlayerCount(), 2)
  await enterBoneyard(leader.page)
  await Promise.all(clients.map(client => client.page.locator(
    '.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })))
  const state = sharedState()
  assert.ok(state.world.hallOfFameRuns[leader.id] && state.world.hallOfFameRuns[peer.id])
  // Declared numerical fixtures enter the real shared authority and replicate
  // to two actual connected browser peers; no synthetic actor is inserted.
  // One member owns the authoritative book pause. Exercise both actual
  // members in turn, including live changes while that member's book stays open.
  for (const client of clients) {
    setNumbers(6, { [leader.id]: [17, 91], [peer.id]: [53, 701] })
    await client.page.getByRole('button', { name: /Open inventory/ }).click()
    await capture(client, 'party-owned-values', 6, { [leader.id]: [17, 91], [peer.id]: [53, 701] })
    setNumbers(7, { [leader.id]: [19, 164], [peer.id]: [53, 701] })
    await capture(client, 'leader-live-update-peer-unchanged', 7, { [leader.id]: [19, 164], [peer.id]: [53, 701] })
    setNumbers(7, { [leader.id]: [19, 164], [peer.id]: [57, 919] })
    await capture(client, 'peer-live-update-leader-unchanged', 7, { [leader.id]: [19, 164], [peer.id]: [57, 919] })
    setNumbers(0, { [leader.id]: [19, 164], [peer.id]: [57, 919] })
    await capture(client, 'shared-zero-wave-omitted', 0, { [leader.id]: [19, 164], [peer.id]: [57, 919] })
    const inventory = client.page.getByRole('dialog', { name: 'Inventory', exact: true })
    await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
    await inventory.waitFor({ state: 'hidden' })
    await Promise.all(clients.map(member => member.page.locator(
      '.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })))
  }
  const runId = sharedState().world.runId
  const saved = await peer.page.waitForFunction(() => new Promise((resolveSave, reject) => {
    const opened = indexedDB.open('solomon-dark-game-saves', 1)
    opened.onerror = () => reject(opened.error)
    opened.onsuccess = () => {
      const database = opened.result
      const request = database.transaction('slots', 'readonly').objectStore('slots').get(0)
      request.onerror = () => { database.close(); reject(request.error) }
      request.onsuccess = () => {
        database.close()
        const record = request.result
        const token = JSON.parse(record?.document ?? 'null')?.continuation?.summary?.partyRejoinToken
        resolveSave(typeof token === 'string' ? record : null)
      }
    }
  }))
  const token = JSON.parse((await saved.jsonValue()).document).continuation.summary.partyRejoinToken
  await saved.dispose()
  await peer.page.locator('.boneyard-world-canvas').focus()
  await peer.page.keyboard.press('Escape')
  await peer.page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
    .getByRole('button', { name: 'LEAVE GAME' }).click()
  await peer.page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  await waitUntil(() => host.humanPlayerCount() === 1, 'Peer did not detach from the actual socket', 10_000)
  assert.equal(host.partyRejoinTarget(token)?.status, 'detached')
  // The active leader changes after the peer's saved snapshot. Rejoining must
  // preserve the current shared run instead of rolling it back to that save.
  setNumbers(8, { [leader.id]: [31, 271] })
  await peer.page.getByRole('button', { name: 'Play', exact: true }).click()
  const rejoin = peer.page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/rejoin')
  await peer.page.getByRole('button', { name: 'Last game', exact: true }).click()
  assert.equal((await rejoin).status(), 201)
  await Promise.all(clients.map(client => client.page.locator(
    '.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })))
  assert.equal(host.humanPlayerCount(), 2)
  assert.equal(sharedState().world.runId, runId)
  assert.ok(peer.sockets >= 2, 'Rejoin must use a new actual WebSocket connection')
  await peer.page.getByRole('button', { name: /Open inventory/ }).click()
  await capture(peer, 'rejoined-current-shared-wave', 8, { [peer.id]: [57, 919] })
  setNumbers(8, { [peer.id]: [63, 1001] })
  await capture(peer, 'rejoined-owner-live-update', 8, { [peer.id]: [63, 1001] })
  const peerInventory = peer.page.getByRole('dialog', { name: 'Inventory', exact: true })
  await peerInventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await peerInventory.waitFor({ state: 'hidden' })
  await leader.page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await leader.page.getByRole('button', { name: /Open inventory/ }).click()
  await capture(leader, 'rejoin-preserves-leader-current-values', 8, { [leader.id]: [31, 271] })
  assert.ok(clients.every(client => client.sockets > 0))
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [], wire: [] })

  function setNumbers(wave, runs) {
    const state = host.playerState(leader.id)
    assert.ok(state && state.world.kind === 'boneyard' && state.world.waves)
    const world = state.world
    Object.assign(state, { world: { ...world,
      waves: { ...world.waves, waveOrdinal: wave, phase: 'interwave', interwaveDelayTicks: 100_000 },
      hallOfFameRuns: { ...world.hallOfFameRuns, ...Object.fromEntries(Object.entries(runs).map(([id, [monstersKilled, awesomeness]]) =>
        [id, { ...world.hallOfFameRuns[id], monstersKilled, awesomeness }])) },
    } })
  }

  function sharedState() {
    const state = host.playerState(leader.id)
    const peerState = host.playerState(peer.id)
    assert.ok(state && state.world.kind === 'boneyard' && state.world.waves)
    assert.ok(peerState && peerState.world.kind === 'boneyard')
    assert.equal(peerState.world.runId, state.world.runId)
    return state
  }

  async function capture(client, name, wave, runs) {
    const [monstersKilled, awesomeness] = runs[client.id]
    const expected = [...(wave > 0 ? [`Wave: ${wave}`] : []), `Kills: ${monstersKilled}`, `Awesomeness: ${awesomeness}`]
    await client.page.waitForFunction(texts => {
      const value = document.querySelector('.hub-inventory-native-canvas[data-native-reveal="settled"]')?.dataset.nativeInventoryRunSummary
      return value && JSON.stringify(JSON.parse(value).map(line => line.text)) === JSON.stringify(texts)
    }, expected)
    const inventory = client.page.getByRole('dialog', { name: 'Inventory', exact: true })
    const surface = inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    await surface.screenshot({ path: join(output, `${name}-${client.element}.png`) })
    const lines = JSON.parse(await surface.getAttribute('data-native-inventory-run-summary'))
    assert.deepEqual(lines.map(line => line.text), expected)
    assert.deepEqual(lines.map(line => [line.x, line.y]), [...(wave > 0 ? [[800, 329]] : []), [800, 344], [800, 364]])
    const frame = await client.page.locator('.boneyard-world-canvas').evaluate(node => ({
      runId: node.__sdrBoneyardFrame.runId,
      playerCount: node.__sdrBoneyardFrame.playerCount,
    }))
    assert.equal(frame.runId, sharedState().world.runId)
    assert.equal(frame.playerCount, 2)
    receipts.push({ name, playerId: client.id, runId: frame.runId, summary: { wave, monstersKilled, awesomeness }, lines })
  }
} catch (error) {
  failure = `${error.name}: ${error.message}`
  for (const client of clients) await client.page.screenshot({ path: join(output, `failure-${client.element}.png`) })
  throw error
} finally {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ receipts, errors, failure,
    peers: clients.map(client => ({ playerId: client.id, sockets: client.sockets, wire: client.wire.frames })),
    qualification: 'Built dist client, actual ticket-authenticated local WebSocket peers, public invitation/acceptance and saved-claim leave/rejoin through the established local provisioning/socket-address fixture. Sequential pause-owner books retain live owner/peer checks and reject stale pre-disconnect values. Declared authoritative numeric fixtures; public managed-service/live and physical-device evidence remain separate.' }, null, 2) + '\n')
  await Promise.all(clients.map(client => client.context.close()))
  await browser.close()
  await host.close()
  await server.close()
}

function issueTicket(admission) {
  const credential = randomBytes(32).toString('base64url')
  tickets.set(credential, admission)
  return credential
}

function endpoint(credential) {
  return { kind: 'remote', sessionKind: 'global-hub', url: `${endpointOrigin}/game`, credential }
}
