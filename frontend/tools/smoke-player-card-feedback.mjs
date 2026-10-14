import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameSocialBroker } from '../src/game/host/game-social-broker.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { GameWelcomeReceiver } from '../src/game/protocol/game-welcome-transfer.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol-contract.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_PLAYER_CARD_OUTPUT
assert.ok(output)
await mkdir(output, { recursive: true })
const root = process.env.SDR_CLIENT_ROOT || fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url))
const server = await startStaticClientServer({ root })
const credential = randomBytes(32).toString('base64url')
const errors = { page: [], console: [], responses: [], requests: [], host: [], assetReads: [] }
const host = await startGameHost({ allowedOrigins: [server.origin], sessionKind: 'private-college',
  snapshotRate: 20, resetWhenEmpty: true, socialBroker: startGameSocialBroker(), authentication: { kind: 'shared', credential },
  log: entry => { if (entry.level === 'error') errors.host.push(entry) } })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const sockets = [], cards = [], checks = [], heldCards = [], inputs = [], assetReads = [], assets = [], assetTransfers = [], diagnostics = [], wire = []
let holdCards = false, pauseState = null
const baseline = process.argv.includes('--baseline')
let stage = 'launch', result = 'failed', servedDeployment = null, page, cleaningUp = false
const expectedRevision = process.env.SDR_BUILD_REVISION
console.log(JSON.stringify({ pid: process.pid, origin: server.origin, host: host.address.url }))
try {
 assert.match(expectedRevision || '', /^[0-9a-f]{40}$/)
 if (!baseline) assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' }).trim(), expectedRevision)
 servedDeployment = await fetch(`${server.origin}/deployment.json`).then(response => { assert.ok(response.ok); return response.json() })
 assert.equal(servedDeployment.revision, expectedRevision)
 page = await context.newPage()
 page.on('pageerror', error => errors.page.push(error.message))
 page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
 page.on('response', response => {
  if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
  const url = new URL(response.url())
  if (url.origin === server.origin && url.pathname.startsWith('/assets/')) {
   const transfer = { url: response.url(), status: response.status(), startedAt: Date.now(), completedAt: null, error: null, cleanup: false }
   assetTransfers.push(transfer)
   assetReads.push((async () => {
    const served = await response.body(), local = await readFile(join(root, decodeURIComponent(url.pathname)))
    assert.ok(served.equals(local), `served asset differs: ${url.pathname}`)
    assets.push({ path: url.pathname, sha256: createHash('sha256').update(served).digest('hex') })
   })().catch(error => {
    transfer.error = error.message; transfer.cleanup = cleaningUp
    errors.assetReads.push({ url: transfer.url, status: transfer.status, message: error.message, cleanup: cleaningUp })
   }).finally(() => { transfer.completedAt = Date.now() }))
  }
 })
 page.on('requestfailed', request => errors.requests.push(`${request.failure()?.errorText} ${request.url()}`))
 await page.routeWebSocket('wss://player-card-feedback.invalid/game', route => {
  const socket = new WebSocket(host.address.url, { origin: server.origin }), pending = []
  sockets.push(socket)
  route.onMessage(message => { const parsed = JSON.parse(message.toString()); if (parsed.type === 'client-input') inputs.push(parsed.input); if (parsed.type === 'client-gameplay-pause' || parsed.type === 'client-player-card-request') wire.push({ at: Date.now(), direction: 'client', message: parsed }); if (socket.readyState === WebSocket.OPEN) socket.send(message); else pending.push(message) })
  socket.on('open', () => { for (const message of pending) socket.send(message); pending.length = 0 })
  socket.on('message', data => { const payload = data.toString(); const parsed = JSON.parse(payload); if (parsed.type === 'server-gameplay-pause') { pauseState = parsed.pause; wire.push({ at: Date.now(), direction: 'server', message: parsed }) } if (parsed.type === 'server-player-card') { cards.push(parsed); if (holdCards) { heldCards.push(() => route.send(payload)); return } } route.send(payload) })
  socket.on('close', () => route.close())
  route.onClose(() => socket.close())
 })
 await page.addInitScript(({ credential, key, settings }) => {
  localStorage.setItem(key, JSON.stringify(settings))
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'remote', sessionKind: 'private-college', credential, url: 'wss://player-card-feedback.invalid/game' } }
 }, { credential, key: GAME_SETTINGS_STORAGE_KEY, settings: { ...DEFAULT_GAME_SETTINGS, musicVolumePercent: 0, soundVolumePercent: 0 } })
 stage = 'enter-hub'; console.log(stage)
 await enterElementHub(page, server.origin, 'Fire')
 const socket = new WebSocket(host.address.url, { origin: server.origin }); sockets.push(socket)
 await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
 const welcome = new Promise((resolve, reject) => {
  const receiver = new GameWelcomeReceiver(), timer = setTimeout(() => reject(new Error('peer welcome timeout')), 15000)
  socket.on('message', data => { const message = receiver.receivePayload(data.toString(), payload => socket.send(payload)); if (message?.type === 'server-disconnect' || message?.type === 'server-error') { clearTimeout(timer); reject(new Error(JSON.stringify(message))) } if (message?.type === 'server-welcome') { clearTimeout(timer); resolve(message) } })
  socket.on('close', () => receiver.close())
 })
 socket.send(JSON.stringify({ type: 'client-hello', credential, protocolVersion: GAME_PROTOCOL_VERSION,
  character: { discipline: 'arcane', displayName: 'Synthetic Peer', element: 'fire' }, cheatsEnabled: false, enhancedEffects: true,
  onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: false },
  profile: { accountUsername: null, highestWave: 1, totalPlaytimeMs: 0 } }))
 await welcome
 socket.send(JSON.stringify({ type: 'client-chat', channel: 'global', text: 'Retained disconnected player card' }))
 await page.keyboard.press('t')
 await page.getByRole('tab', { name: /^Global/ }).click()
 const author = page.locator('[data-message-channel="global"]', { hasText: 'Retained disconnected player card' }).locator('.game-chat-player-name')
 await author.waitFor()
 await page.getByRole('button', { name: 'Close chat', exact: true }).click()
 await new Promise(resolve => { socket.once('close', resolve); socket.close() })
 stage = 'enter-boneyard'; console.log(stage)
 await enterBoneyard(page)
 await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })
 stage = 'request-disconnected-card'; console.log(stage)
 await page.keyboard.press('t'); await page.getByRole('tab', { name: /^Global/ }).click(); await author.click()
 await page.getByText('That wizard is no longer available.', { exact: true }).waitFor()
 assert.equal(cards.at(-1)?.profile, null)
 const tick = host.state().tick
 if (baseline) {
  await page.waitForTimeout(6500)
  assert.ok(host.state().tick > tick, 'gameplay ticks must continue')
  checks.push({ disconnectedCard: cards.at(-1), elapsedMs: 6500, status: await page.locator('.main-menu-runtime-status').textContent() })
  assert.match(checks.at(-1).status, /That wizard is no longer available/)
  await pause()
  await capturePaused('paused-banner.png')
  result = 'baseline-reproduced'
 } else {
  const feedback = page.locator('.main-menu-player-card-feedback')
  const dismiss = page.getByRole('button', { name: 'Dismiss Player Card message', exact: true })
  await feedback.waitFor({ state: 'detached', timeout: 7500 })
  assert.ok(host.state().tick > tick, 'notice did not stop gameplay')
  assert.equal(await page.locator('.main-menu-runtime-status').count(), 0)
  checks.push('unavailable card automatically expires while gameplay advances')

  stage = 'keyboard-dismiss'; console.log(stage)
  await requestCard()
  await dismiss.focus()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="true"]').waitFor()
  const before = inputs.length
  const position = { ...host.state().playerEntities.locomotions[0].position }
  const nextSpell = host.state().primarySpells.nextId
  await page.keyboard.down('w'); await page.keyboard.down(' ')
  await page.waitForTimeout(200)
  await page.keyboard.up('w'); await page.keyboard.up(' ')
  await feedback.waitFor({ state: 'detached' })
  const focused = inputs.slice(before)
  assert.deepEqual(host.state().playerEntities.locomotions[0].position, position, 'focused keys moved the wizard')
  assert.equal(host.state().primarySpells.nextId, nextSpell, 'focused Space cast a spell')
  assert.ok(focused.every(input => !input.cast.primary && input.movement.x === 0 && input.movement.y === 0), 'focused dismissal leaked gameplay input')
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  checks.push('focused Space dismissal blocks movement/casting and releases gameplay focus')

  stage = 'focused-expiry'; console.log(stage)
  await requestCard(); await dismiss.focus()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="true"]').waitFor()
  await feedback.waitFor({ state: 'detached', timeout: 7500 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  checks.push('expiry removes focused notice and restores gameplay input')

  stage = 'repeated-response-race'; console.log(stage)
  holdCards = true
  await requestCard(false)
  await waitUntil(() => heldCards.length === 1, 'first card response not held', 5000)
  await requestCard(false)
  await waitUntil(() => heldCards.length === 2, 'second card response not held', 5000)
  heldCards.shift()()
  await page.waitForTimeout(100)
  assert.equal(await feedback.count(), 0)
  assert.equal(await page.getByText('Opening Player Card…', { exact: true }).count(), 1)
  heldCards.shift()(); holdCards = false
  await feedback.waitFor()
  await dismiss.click()
  checks.push('late earlier null result cannot clear newer pending request')

  stage = 'save-failure-priority'; console.log(stage)
  await pause()
  await page.evaluate(() => {
   const original = IDBDatabase.prototype.transaction
   window.__restorePlayerCardSaveFixture = () => { IDBDatabase.prototype.transaction = original }
   IDBDatabase.prototype.transaction = function(...args) {
    if (this.name === 'solomon-dark-game-saves' && args[1] === 'readwrite') throw new Error('Synthetic save storage unavailable.')
    return original.apply(this, args)
   }
  })
  await page.getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
  const serious = page.locator('.main-menu-runtime-status[role="alert"]')
  await serious.getByText('Synthetic save storage unavailable.', { exact: true }).waitFor()
  await page.evaluate(() => window.__restorePlayerCardSaveFixture())
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).click()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 15000 })
  await requestCard(false)
  await page.waitForTimeout(100)
  assert.equal(await serious.textContent(), 'Synthetic save storage unavailable.')
  assert.equal(await feedback.count(), 0)
  await page.waitForTimeout(5500)
  assert.equal(await serious.textContent(), 'Synthetic save storage unavailable.')
  checks.push('new card request and card error expiry preserve serious save error state and visibility')
  await pause()
  await capturePaused('paused-save-error-priority.png')
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).click()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 15000 })

  stage = 'leave-with-pending-card'; console.log(stage)
  holdCards = true
  await requestCard(false)
  await waitUntil(() => heldCards.length === 1, 'pending teardown card response not held', 5000)
  const runId = host.state().world.runId
  await pause()
  await page.getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 })
  // Session destruction rejects the held request locally. Its old server payload is never forged or sent to a replacement socket.
  heldCards.length = 0; holdCards = false
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: /^Last game$/i }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90000 })
  assert.equal(host.state().world.runId, runId)
  assert.equal(await page.locator('.main-menu-runtime-status').count(), 0)
  assert.equal(await page.locator('.hub-player-profile').count(), 0)
  checks.push('real save/leave destroys pending request; Last Game restores matching run with no stale card/error/busy state')
  await pause()
  await capturePaused('paused-clean-reentry.png')
  await Promise.all(assetReads)
  assert.ok(assets.some(asset => asset.path.endsWith('.js')), 'actual built JavaScript was not verified')
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], host: [], assetReads: [] })
  result = 'passed'
 }
 async function requestCard(expectFeedback = true) {
  diagnostics.push(await diagnostic('before-card-request'))
  await page.keyboard.press('t')
  await page.getByRole('tab', { name: /^Global/ }).click()
  await author.click()
  if (expectFeedback) await page.locator('.main-menu-player-card-feedback').waitFor()
 }
 async function pause() {
  await page.locator('.game-chat[data-chat-open="false"]').waitFor()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 15000 })
  assert.equal(host.state().run.phase, 'active')
  diagnostics.push(await diagnostic('before-pause'))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).waitFor({ timeout: 10000 })
  await waitUntil(() => pauseState?.ownerPlayerId === host.hostPlayerId() && pauseState?.source === 'pause-menu', 'owner pause was not acknowledged', 5000)
  await page.locator('.boneyard-scene[data-presentation-paused="true"]').waitFor()
  const pausedTick = host.state().tick
  await page.waitForTimeout(150)
  assert.equal(host.state().tick, pausedTick, 'review screenshot requires frozen Boneyard authority')
 }
 async function diagnostic(label) {
  return { label, at: Date.now(), stage, tick: host.state().tick, world: host.state().world.kind,
   runPhase: host.state().run.phase, pause: pauseState, wire: wire.slice(-6),
   dom: await page.evaluate(() => ({
    chatOpen: document.querySelector('.game-chat')?.getAttribute('data-chat-open'),
    inputBlocked: document.querySelector('.boneyard-scene')?.getAttribute('data-gameplay-input-blocked'),
    presentationPaused: document.querySelector('.boneyard-scene')?.getAttribute('data-presentation-paused'),
    focus: document.activeElement?.outerHTML.slice(0, 500), body: document.body.innerText.slice(-1500),
   })) }
 }
 async function capturePaused(name) {
  assert.equal(host.state().world.kind, 'boneyard')
  assert.equal(pauseState?.ownerPlayerId, host.hostPlayerId())
  assert.equal(pauseState?.source, 'pause-menu')
  await page.locator('.boneyard-scene[data-presentation-paused="true"]').waitFor()
  const tick = host.state().tick
  const frameBefore = await page.evaluate(() => {
   const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
   if (!frame) throw new Error('retained Boneyard frame missing')
   window.__playerCardPausedFrame = frame
   return structuredClone(frame)
  })
  await page.waitForTimeout(150)
  assert.deepEqual(await page.evaluate(() => structuredClone(document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame)), frameBefore, 'retained renderer advanced before paused screenshot')
  await page.screenshot({ path: `${output}/${name}` })
  assert.deepEqual(await page.evaluate(() => structuredClone(document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame)), frameBefore, 'retained renderer advanced across paused screenshot')
  assert.equal(host.state().tick, tick, 'authority advanced across paused screenshot')
  assert.equal(await page.evaluate(() => window.__playerCardPausedFrame === document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame), true, 'retained renderer changed across paused screenshot')
  checks.push({ screenshot: name, tick, frameTick: frameBefore.tick, pause: { ...pauseState } })
 }
 console.log(JSON.stringify({ result, checks, errors }))
} catch (error) {
 if (page) diagnostics.push({ label: 'failure', at: Date.now(), stage, tick: host.state().tick,
  runPhase: host.state().run.phase, pause: pauseState, wire: wire.slice(-10),
  dom: await page.evaluate(() => ({ body: document.body.innerText.slice(-2000), focus: document.activeElement?.outerHTML.slice(0, 500),
   chatOpen: document.querySelector('.game-chat')?.getAttribute('data-chat-open'),
   inputBlocked: document.querySelector('.boneyard-scene')?.getAttribute('data-gameplay-input-blocked'),
   presentationPaused: document.querySelector('.boneyard-scene')?.getAttribute('data-presentation-paused') })).catch(failure => ({ error: failure.message })) })
 console.error(JSON.stringify({ stage, message: error.message })); throw error
} finally {
 cleaningUp = true
 const cleanupErrors = []
 for (const [name, close] of [
  ['context', () => context.close()], ['peer-sockets', async () => { for (const socket of sockets) socket.close() }],
  ['browser', () => browser.close()], ['host', () => host.close()], ['static-server', () => server.close()],
 ]) {
  try { await close() } catch (error) { cleanupErrors.push({ owner: name, message: error.message }) }
 }
 await Promise.all(assetReads)
 if (errors.assetReads.length || cleanupErrors.length) result = 'failed'
 await writeFile(`${output}/receipt.json`, JSON.stringify({ result, stage, servedDeployment, assets, assetTransfers,
  checks, cards, diagnostics, errors, cleanupErrors }, null, 2))
 assert.deepEqual(cleanupErrors, [], 'owned runtime cleanup failed')
 assert.deepEqual(errors.assetReads, [], 'served-asset verification failed')
 console.log('owned runtime closed')
}
