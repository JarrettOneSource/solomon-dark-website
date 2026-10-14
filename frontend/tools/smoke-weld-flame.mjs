import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { WebSocket } from 'ws'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { applyNativeSecondaryTargetEffect } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { canPlaceBoneyardBody, clipBoneyardSegment } from '../src/game/core-server/boneyard-collision.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { grantPlayerEntitySkillRanks, grantPlayerEntityWeldBuild, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../src/game/host/native-generated-boneyards.ts'
import { gameSnapshot } from '../src/game/protocol/codecs/snapshot.ts'
import { createGameSimulation, enterBoneyardWorld, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'
import { GameWelcomeReceiver } from '../src/game/protocol/game-welcome-transfer.ts'
import { projectNativeWorldPointer } from '../src/game/input/gameplay-pointer.ts'
import { boundedGameViewportLayout } from '../src/game/renderer/game-viewport.ts'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

// Uses the built candidate and an ephemeral local authority. Account,
// directory/provisioning, skills, resources and frozen target placement are
// controlled fixtures. Held input, owner/peer/true observer protocol frames,
// timelines and WebGL rendering use their actual production owners.
const CAST_PHASES = [
  ['normal-long-chain', { distance: 260, targets: true, weak: false }],
  ['normal-short-chain', { distance: 35, targets: true, weak: false }],
  ['targetless-long', { distance: 360, targets: false, weak: false }],
  ['weak-targetless', { distance: 360, targets: false, weak: true }],
  ['weak-short-contact', { distance: 35, targets: true, weak: true }],
]
const BROWSER_VIEWPORT = { width: 1280, height: 800 }
if (process.argv.includes('--preflight')) { preflightFixture(); process.exit(0) }
if (process.argv.includes('--preflight-stock')) { preflightStockFixtures(); process.exit(0) }
const output = process.env.SDR_FLAME_OUTPUT || '/tmp/solomon-report116-browser'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const credential = randomBytes(32).toString('base64url')
const observerCredential = randomBytes(32).toString('base64url')
const emptyContent = { assets: [], boneyards: [], compiledMods: [], modSources: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] }, summary: { manifestSha256: '0'.repeat(64), mods: [] } }
const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
let host
host = await startGameHost({ allowedOrigins: [origin], sessionKind: 'private-college', snapshotRate: 20, resetWhenEmpty: true,
  authentication: { kind: 'tickets', claim(value) {
    if (value === credential) return { content: emptyContent, leaderboardUserId: null }
    if (value === observerCredential && host.state().world.kind === 'boneyard') return {
      content: emptyContent, leaderboardUserId: null, developerAccess: true,
      observer: { runId: host.state().world.runId, userId: 1, username: 'Flame acceptance' },
    }
    return null
  } }, log: entry => { if (entry.level === 'error') errors.host.push({ event: entry.event, message: entry.message }) },
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
})
const contexts = [], bridges = [], roles = [], phases = []
const servedAssetUrls = new Set()
let servedDeployment
let refill, hostSampler, progressTimer, fixtureAnchor, weak = false
let stage = 'launch'
const hostBirths = new Map()
try {
  assert.match(process.env.SDR_BUILD_REVISION ?? '', /^[0-9a-f]{40}$/)
  const deploymentResponse = await fetch(`${origin}/deployment.json`)
  assert.ok(deploymentResponse.ok)
  servedDeployment = await deploymentResponse.json()
  assert.equal(servedDeployment.revision, process.env.SDR_BUILD_REVISION)
  progressTimer = setInterval(async () => {
    const views = await Promise.all(roles.map(async ({ name, page }) => ({ name, url: page.url(),
      text: await page.locator('body').innerText({ timeout: 1_000 }).then(text => text.slice(0, 500)).catch(() => 'unavailable') })))
    console.log(JSON.stringify({ stage, views, errors }))
  }, 15_000)
  const owner = await role('owner')
  stage = 'owner-enter-hub'
  await enterElementHub(owner.page, origin, 'Fire')
  stage = 'peer-enter-hub'
  const peer = await role('peer')
  await enterElementHub(peer.page, origin, 'Fire')
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const grant = grantPlayerEntityWeldBuild(host.state().playerEntities, playerId, 1003, host.state().gameRng)
  Object.assign(host.state(), { playerEntities: grant.store, gameRng: grant.rng })
  await owner.page.bringToFront()
  const hubNextId = host.state().primarySpells.nextId
  const hubCanvas = owner.page.locator('.hub-world-canvas')
  const hubBounds = await hubCanvas.boundingBox()
  await owner.page.mouse.move(hubBounds.x + hubBounds.width * .7, hubBounds.y + hubBounds.height * .4)
  await owner.page.mouse.down(); await owner.page.waitForTimeout(300); await owner.page.mouse.up()
  assert.equal(host.state().primarySpells.nextId, hubNextId, 'The sealed Hub admitted a combat birth')
  refill = setInterval(() => {
    const state = host.state()
    let store = state.playerEntities
    for (const [index, row] of store.identities.entries()) {
      store = setPlayerEntityMana(store, row.playerId, weak && row.playerId === playerId ? 0 : store.progressions[index].maximumMana)
    }
    Object.assign(state, { playerEntities: { ...store,
      progressions: store.progressions.map(p => ({ ...p, currentHealth: p.maximumHealth })) } })
  }, 5)
  stage = 'owner-enter-boneyard'
  await enterBoneyard(owner.page)
  await openBoneyardCombat(host, playerId)
  const ready = host.state()
  clearStartupCombat(ready)
  const placement = positionForFixtures(ready, playerId)
  fixtureAnchor = placement
  placeFixturePlayer(ready, playerId, placement)
  validateFixture(ready, playerId)
  await peer.page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({ timeout: 90_000 })
  stage = 'observer-enter-boneyard'
  const observer = await role('observer', true)
  await openObserver(observer.page)
  await owner.page.bringToFront()
  await owner.page.waitForFunction(position => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && Math.hypot(frame.playerX - position.x, frame.playerY - position.y) < .1
  }, placement, { timeout: 15_000 })
  hostSampler = setInterval(() => {
    for (const actor of host.state().primarySpells.transients) {
      if (actor.buildId === 1003 && actor.flameVisual?.kind === 'native-birth-v1' && actor.ageTicks === 0) hostBirths.set(actor.id, actor)
    }
  }, 2)
  // Preflight the exact admitted world and all remaining phase fixtures before
  // any browser cast. Clones keep these held-input steps off the live authority.
  const fixturePreflight = preflightPhaseSequence(host.state(), playerId, fixtureAnchor)
  console.log(JSON.stringify({ fixturePreflight }))
  for (const [name, options] of CAST_PHASES) await castPhase(name, owner, playerId, options)
  await owner.page.keyboard.press('Escape')
  await owner.page.getByRole('button', { name: 'GAME SETTINGS', exact: true }).click()
  await owner.page.getByRole('button', { name: 'TWEAK GAME', exact: true }).click()
  await owner.page.getByRole('button', { name: 'ENHANCED EFFECTS', exact: true }).click()
  await waitUntil(() => !host.state().enhancedEffects, 'Coarse effects setting was not admitted', 10_000)
  await owner.page.keyboard.press('Escape')
  await owner.page.getByRole('button', { name: 'TWEAK GAME', exact: true }).waitFor()
  // Closing the root settings page already releases gameplay pause.
  await owner.page.keyboard.press('Escape')
  await owner.page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 15_000 })
  await castPhase('coarse-targetless', owner, playerId, { distance: 360, targets: false, weak: false })
  await owner.page.keyboard.press('Escape')
  await owner.page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]').waitFor()
  await owner.page.waitForFunction(() => Number(document.querySelector('.gameplay-pause-overlay')?.getAttribute('data-gameplay-pause-reveal')) === 1)
  const pausedTick = host.state().tick
  await owner.page.waitForTimeout(200)
  assert.equal(host.state().tick, pausedTick, 'Final captures require acknowledged real owner pause')
  for (const recipient of roles) {
    const rendered = await recipient.page.evaluate(() => window.__flameFrames)
    assert.ok(rendered.some(frame => frame.kinds.includes('weld-channel:1003')), `${recipient.name} never rendered the Flame ribbon`)
    assert.ok(rendered.some(frame => frame.kinds.includes('weld-flame-lash-fade:1003')), `${recipient.name} never rendered Flame fades`)
    for (const kind of ['ribbon', 'fade']) {
      const ids = new Set([...recipient.births.values()].filter(birth => birth.recipe.kind === kind).map(birth => birth.id))
      assert.ok(rendered.some(frame => frame.painters.some(key => ids.has(Number(key.split(':')[1])))),
        `${recipient.name}: ${kind} had no actual painter-root insertion`)
    }
    await recipient.page.screenshot({ path: `${output}/${recipient.name}-released.png` })
    assert.equal(host.state().tick, pausedTick, 'Authority remained frozen throughout each final capture')
  }
  const common = [...owner.births.keys()].filter(id => peer.births.has(id) && observer.births.has(id))
  assert.ok(common.length >= 10, 'Owner, peer and true observer lacked common retained births')
  assert.ok(owner.historyOnlyBirths.size > 0, 'The live journey did not exercise births absent from endpoint live arrays')
  for (const id of common) {
    assert.deepEqual(peer.births.get(id).recipe, owner.births.get(id).recipe)
    assert.deepEqual(observer.births.get(id).recipe, owner.births.get(id).recipe)
  }
  assert.ok(Object.values(errors).every(list => list.length === 0), JSON.stringify(errors))
  const receipt = { status: 'ok', browser: browser.version(), muted: true, phases,
    servedDeployment, servedAssetUrls: [...servedAssetUrls].sort(), pausedCaptureTick: pausedTick,
    welcomes: roles.map(({ name, welcome }) => ({ name, ...welcome })),
    hubCombatSealed: true, commonOwnerPeerObserverBirths: common.length, historyOnlyBirths: owner.historyOnlyBirths.size,
    sampledHostBirths: hostBirths.size,
    errors, boundaries: ['Synthetic local account/directory/provisioning and controlled cast fixtures; no live TLS qualification',
      'Terminal payload order is checked by actual held-input simulation preflight, separately from browser phases',
      'Recovered camera payload and first-decay phase are tested; no native-runtime/x87 or pixel-equivalence claim'],
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} catch (error) {
  // Failure may occur before a real pause is admitted. Preserve diagnostics,
  // without taking an unpaused screenshot or mutating the failed phase.
  console.error(JSON.stringify({ message: error.message, errors, phases }))
  throw error
} finally {
  clearInterval(refill); clearInterval(hostSampler); clearInterval(progressTimer)
  for (const bridge of bridges) bridge.close()
  await Promise.allSettled(contexts.map(context => context.close()))
  await browser.close(); await host.close(); await new Promise(resolve => frontend.httpServer.close(resolve))
}

async function role(name, observer = false) {
  const context = await browser.newContext({ viewport: BROWSER_VIEWPORT, deviceScaleFactor: 1 })
  contexts.push(context)
  const page = await context.newPage()
  const result = { name, page, births: new Map(), historyOnlyBirths: new Set(), latest: null, inputs: [], inputOrdinal: 0 }
  roles.push(result)
  page.on('pageerror', error => errors.page.push(`${name}: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(`${name}: ${message.text()}`) })
  page.on('response', response => {
    if (response.status() >= 400) errors.responses.push(`${name}: ${response.status()} ${response.url()}`)
    const url = new URL(response.url())
    if (url.origin === origin && url.pathname.startsWith('/assets/')) servedAssetUrls.add(url.pathname)
  })
  page.on('requestfailed', request => errors.requests.push(`${name}: ${request.url()}: ${request.failure()?.errorText}`))
  await capturePrivateCollegeBridge(page, result, observer)
  await page.addInitScript(({ endpoint, settingsKey, settings, observer }) => {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
    if (observer) localStorage.setItem('sdr.token', 'local-flame-observer-fixture')
    else window.solomonDarkRuntime = { gameEndpoint: endpoint }
    window.__flameFrames = []
    function sample() {
      const canvas = document.querySelector('.boneyard-world-canvas')
      const frame = canvas?.__sdrBoneyardFrame
      if (frame) {
        window.__flameFrames.push({ tick: frame.tick, kinds: [...frame.primarySpellKinds],
          painters: Object.keys(frame.primarySpellPainterDepths), enhanced: canvas.dataset.enhancedEffects })
        if (window.__flameFrames.length > 2400) window.__flameFrames.shift()
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, { endpoint: { credential, kind: 'remote', sessionKind: 'private-college', url: 'wss://flame-acceptance.invalid/game' },
    settingsKey: GAME_SETTINGS_STORAGE_KEY, settings: { ...DEFAULT_GAME_SETTINGS, musicVolumePercent: 0, soundVolumePercent: 0 }, observer })
  return result
}

async function openObserver(page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const user = { id: 1, username: 'Flame acceptance', developerAccess: true, school: null, createdAtUtc: '2026-10-14T00:00:00Z' }
    const json = path === '/api/auth/me' ? { user, modCount: 0, saveCount: 0 }
      : path === '/api/game/saves/0' ? { save: null }
        : path === '/api/mods/active' ? { mods: [], disabledMods: [], manifestSha256: '0'.repeat(64) }
          : path === '/api/game/observe' ? { kind: 'remote', sessionKind: 'private-college', observer: true,
            url: 'wss://flame-acceptance.invalid/game', credential: observerCredential }
            : path === '/api/game/matches' ? { items: [{ id: 'local-flame', boneyardName: 'Flame acceptance',
              partyLeader: 'Owner', playerCount: 2, players: ['Owner', 'Peer'], session: 'private-college', visibility: 'private', waveNumber: 1 }] }
              : { items: [], total: 0, page: 1, pageSize: 50 }
    return route.fulfill({ json })
  })
  await page.goto(`${origin}/game`, { waitUntil: 'domcontentloaded' })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  await Promise.race([tutorial.waitFor({ timeout: 90_000 }),
    page.getByRole('button', { name: 'Explore the Dark Cloud', exact: true }).waitFor({ timeout: 90_000 })])
  if (await tutorial.isVisible()) {
    await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorial.waitFor({ state: 'hidden', timeout: 15_000 })
  }
  await page.getByRole('button', { name: 'Explore the Dark Cloud', exact: true }).click({ timeout: 90_000 })
  await page.getByRole('tab', { name: 'PARTIES', exact: true }).click()
  await page.getByRole('button', { name: 'OBSERVE', exact: true }).click()
  await page.locator('.developer-observer-scene .boneyard-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({ timeout: 90_000 })
}

async function castPhase(name, owner, playerId, options) {
  stage = name
  weak = options.weak
  const state = host.state()
  resetControlledFixture(state, playerId, fixtureAnchor)
  await waitUntil(() => roles.every(recipient => {
    const position = recipient.latest?.players[playerId]?.position
    return position && Math.hypot(position.x - fixtureAnchor.x, position.y - fixtureAnchor.y) < .1
  }), `${name}: fixture anchor was not replicated to every recipient`, 10_000)
  await owner.page.waitForFunction(position => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && Math.hypot(frame.playerX - position.x, frame.playerY - position.y) < .1
  }, fixtureAnchor, { timeout: 10_000 })
  const planned = planCastFixture(host.state(), playerId, name, options)
  const fixture = prepareCastFixture(host.state(), playerId, name, { ...options, fixtureAngle: planned.angle })
  const fixtureProof = planned.proof
  console.log(JSON.stringify({ stage, fixtureProof }))
  await owner.page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 20_000 })
  const firstId = host.state().primarySpells.nextId
  const aim = fixture.aim
  const geometry = await owner.page.locator('.boneyard-world-canvas').evaluate(canvas => {
    const frame = canvas.__sdrBoneyardFrame, bounds = canvas.getBoundingClientRect()
    return { frame: { playerScreenX: frame.playerScreenX, playerScreenY: frame.playerScreenY,
      playerX: frame.playerX, playerY: frame.playerY, cameraX: frame.cameraX, cameraY: frame.cameraY, cameraZoom: frame.cameraZoom },
      surface: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } }
  })
  const { frame, surface } = geometry
  // Diagnostic screen coordinates are logical pixels; invert the actual
  // gameplay-pointer owner through the CSS surface, including displayScale.
  const viewport = { width: 2 * (frame.playerScreenX - (frame.playerX - frame.cameraX) * frame.cameraZoom),
    height: 2 * (frame.playerScreenY - (frame.playerY - frame.cameraY) * frame.cameraZoom) }
  const exactPoint = {
    x: surface.left + (frame.playerScreenX + (aim.x - frame.playerX) * frame.cameraZoom) * surface.width / viewport.width,
    y: surface.top + (frame.playerScreenY + (aim.y - frame.playerY) * frame.cameraZoom) * surface.height / viewport.height,
  }
  const projected = projectNativeWorldPointer(exactPoint, surface, viewport,
    { x: frame.cameraX - viewport.width / 2 / frame.cameraZoom, y: frame.cameraY - viewport.height / 2 / frame.cameraZoom }, frame.cameraZoom)
  assert.ok(Math.hypot(projected.x - aim.x, projected.y - aim.y) < 1e-7, 'Fixture pointer inverse disagrees with production projection')
  // MouseEvent.clientX/Y are integer CSS coordinates in this Chrome path.
  // Choose the actual input lattice explicitly and verify its world projection;
  // a subpixel requested aim is not the aim that gameplay-input receives.
  const point = { x: Math.round(exactPoint.x), y: Math.round(exactPoint.y) }
  const projectedAim = projectNativeWorldPointer(point, surface, viewport,
    { x: frame.cameraX - viewport.width / 2 / frame.cameraZoom, y: frame.cameraY - viewport.height / 2 / frame.cameraZoom }, frame.cameraZoom)
  const inputOrdinal = owner.inputOrdinal
  const inputPreflight = { playerId, fixture, options, checked: false, proof: null, error: null }
  owner.pendingInputPreflight = inputPreflight
  await owner.page.mouse.move(point.x, point.y)
  await owner.page.mouse.down()
  try {
    await waitUntil(() => owner.inputs.some(row => row.ordinal > inputOrdinal && row.input.cast.primary),
      `${name}: actual held-input frame was absent`, 5_000)
    const observed = owner.inputs.find(row => row.ordinal > inputOrdinal && row.input.cast.primary).input
    assert.equal(inputPreflight.error, null, `Actual browser input fixture failed before forwarding: ${inputPreflight.error}`)
    assert.ok(inputPreflight.checked && inputPreflight.proof, 'Actual browser input was not preflighted')
    // BoneyardScene projects each input against a fresh presentation/camera
    // sample. The earlier diagnostic frame is not an input-time oracle.
    // Preserve the delta diagnostically; the unmodified input's authoritative
    // targeting, geometry, weak/chain and fade preflight above is the gate.
    console.log(JSON.stringify({ stage, actualHeldInput: observed, actualInputProof: inputPreflight.proof,
      fixtureAim: aim, projectedAim, point,
      diagnosticFrameAimDelta: Math.hypot(observed.aim.x - projectedAim.x, observed.aim.y - projectedAim.y) }))
    assert.ok(Math.abs(observed.viewportWidth - viewport.width) < .01 && Math.abs(observed.viewportHeight - viewport.height) < .01)
    await waitUntil(() => [...owner.births.values()].some(birth => birth.id >= firstId && birth.recipe.kind === 'ribbon'
      && birth.recipe.weak === options.weak), `${name}: admitted cast produced no complete Flame birth`, 12_000)
    await owner.page.waitForTimeout(800)
    // Live retained-frame and wire assertions below prove this cast. Review
    // captures are taken only after the final real owner pause is admitted.
  } finally { owner.pendingInputPreflight = undefined; await owner.page.mouse.up() }
  await waitUntil(() => host.state().primarySpells.transients.every(actor => actor.buildId !== 1003), `${name}: Flame did not drain`, 5_000)
  await owner.page.waitForTimeout(150)
  const births = [...owner.births.values()].filter(birth => birth.id >= firstId)
  const ribbons = births.filter(birth => birth.recipe.kind === 'ribbon')
  assert.ok(ribbons.length > 0)
  assert.ok(ribbons.every(birth => birth.endTickExclusive - birth.birthTick <= 1))
  for (const birth of ribbons) assert.equal(birth.recipe.birth.cameraDisplacement !== null,
    birth.recipe.birth.role === 'main' && !birth.recipe.weak, 'Camera payload membership differs from the normal main handler')
  if (options.targets && !options.weak) assert.ok(ribbons.some(birth => birth.recipe.birth.role === 'chain'), `${name}: no chain`)
  if (name === 'normal-short-chain' || name === 'weak-short-contact') assert.ok(ribbons.some(birth => birth.recipe.birth.role === 'main'
    && birth.recipe.birth.ribbon.kind === 'short'), 'The short native ribbon branch was not exercised')
  if (name === 'targetless-long') assert.ok(ribbons.some(birth => birth.recipe.birth.ribbon.kind === 'long'))
  if (options.weak) assert.ok(ribbons.every(birth => birth.recipe.birth.role === 'main'))
  assert.ok(births.some(birth => birth.recipe.kind === 'fade' && birth.recipe.variant === 'source'))
  assert.ok(births.some(birth => birth.recipe.kind === 'fade' && birth.recipe.variant === 'endpoint'))
  const alive = host.state().world.enemies.actors
  if (options.targets) assert.ok(alive.some(actor => actor.currentHealth < 100_000), `${name}: no authoritative contact`)
  phases.push({ name, births: births.length, ribbons: ribbons.length, enhanced: host.state().enhancedEffects,
    chainRibbons: ribbons.filter(birth => birth.recipe.birth.role === 'chain').length,
    ribbonKinds: [...new Set(ribbons.map(birth => birth.recipe.birth.ribbon.kind))],
    hostContact: options.targets, targetless: !options.targets, weak: options.weak })
}

function prepareCastFixture(state, playerId, name, options) {
  const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const source = state.playerEntities.locomotions[index].position
  const fixture = contactFixture(state.world, source, options.distance, options.fixtureAngle)
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore(`flame-${name}`), {
    projectileWorldBlocked: () => false, paused: true, players: {}, registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => (options.targets ? fixture.positions : []).map((position, index) => ({
      enemyToken: 'DEMON', flags: [], id: index + 1, locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.DEMON, position, spawnTick: state.tick, waveOrdinal: 1,
    })), tick: state.tick,
  })
  Object.assign(state, { worldManagerOrder: order.state(), world: { ...state.world,
    arenaTransition: null, encounter: null, enemies: { ...spawned.store,
      actors: spawned.store.actors.map((actor, at) => ({ ...actor,
        currentHealth: options.terminal && at === 0 ? .001 : 100_000, maximumHealth: 100_000 })) },
    enemyEvents: [], tutorial: null, waves: null } })
  // Keep each real target at its declared root. This is the existing frozen
  // target-effect fixture seam; no targeting or movement rule is changed.
  let secondary = { ...state.secondaryAbilities, targetEffects: [] }
  for (const actor of state.world.enemies.actors) secondary = applyNativeSecondaryTargetEffect(
    secondary, `boneyard:${state.world.runId}`, actor.id, { frozenTicks: 1_000_000, frozenTimeScale: 0 })
  Object.assign(state, { secondaryAbilities: secondary })
  if (options.terminal && state.playerEntities.skillBooks[index].effectiveRanks[18] === 0) {
    const granted = grantPlayerEntitySkillRanks(state.playerEntities, playerId, 18, 1, state.gameRng)
    Object.assign(state, { playerEntities: granted.store, gameRng: granted.rng })
  }
  refillFixture(state, playerId, options.weak)
  validateFixture(state, playerId)
  // primarySpellAimDirection aims from player.y - 25 / 1.35. At distance35,
  // clicking the unadjusted root can miss the native 15-degree cone entirely.
  return { ...fixture, aim: { x: fixture.positions[0].x, y: fixture.positions[0].y - 25 / 1.35 } }
}

function contactFixture(world, source, distance, selectedAngle) {
  for (const i of selectedAngle === undefined ? Array.from({ length: 32 }, (_, index) => index) : [selectedAngle]) {
    const angle = i * Math.PI / 16, direction = { x: Math.cos(angle), y: Math.sin(angle) }
    const end = clipBoneyardSegment(source, { x: source.x + direction.x * 500, y: source.y + direction.y * 500 }, world.bounds, world.collision)
    if (Math.hypot(end.x - source.x, end.y - source.y) < 400) continue
    const direct = { x: source.x + direction.x * distance, y: source.y + direction.y * distance }
    const chain = { x: direct.x - direction.y * 90, y: direct.y + direction.x * 90 }
    if ([direct, chain].every(point => canPlaceBoneyardBody(point, world.bounds, world.collision, 50))) return { positions: [direct, chain] }
  }
  throw new Error('No clear Flame browser fixture placement')
}

function positionForFixtures(state, playerId) {
  const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const current = state.playerEntities.locomotions[index].position
  const bounds = state.world.bounds
  const candidates = [current]
  for (let y = bounds.y + 150; y < bounds.y + bounds.h - 150; y += 100) {
    for (let x = bounds.x + 150; x < bounds.x + bounds.w - 150; x += 100) candidates.push({ x, y })
  }
  candidates.sort((left, right) => Math.hypot(left.x - current.x, left.y - current.y)
    - Math.hypot(right.x - current.x, right.y - current.y))
  for (const position of candidates) {
    if (!canPlaceBoneyardBody(position, bounds, state.world.collision, 50)) continue
    try {
      for (const distance of [35, 260, 360]) contactFixture(state.world, position, distance)
      const candidate = structuredClone(state)
      placeFixturePlayer(candidate, playerId, position)
      preflightPhaseSequence(candidate, playerId, position)
      return position
    } catch (error) {
      if (!error.message.startsWith('No admitted all-phase Flame fixture')
        && error.message !== 'No clear Flame browser fixture placement') throw error
    }
  }
  throw new Error('No collision-valid all-phase Flame fixture location exists')
}

function placeFixturePlayer(state, playerId, position) {
  const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = { ...locomotions[index], position: { ...position }, velocity: { x: 0, y: 0 } }
  Object.assign(state, { playerEntities: { ...state.playerEntities, locomotions } })
}

function resetControlledFixture(state, playerId, position) {
  // Startup removed uncontrolled combat. Each phase owns only these targets;
  // their body separation must not move the next independent fixture's anchor.
  Object.assign(state, { world: { ...state.world,
    enemies: createBoneyardEnemyStore('flame-phase-reset'), enemyEvents: [] } })
  placeFixturePlayer(state, playerId, position)
}

function clearStartupCombat(state) {
  assert.equal(state.world.kind, 'boneyard')
  Object.assign(state, { world: { ...state.world, arenaTransition: null, encounter: null,
    waves: null, tutorial: null, enemies: createBoneyardEnemyStore('flame-observer-startup'), enemyEvents: [] } })
}

function validateFixture(state, playerId) {
  const snapshot = createGameSnapshot(state, playerId)
  const wireSnapshot = JSON.parse(JSON.stringify(snapshot))
  assert.deepEqual(gameSnapshot(wireSnapshot), wireSnapshot)
  return snapshot
}

function refillFixture(state, playerId, weakCast) {
  let store = state.playerEntities
  for (const [index, row] of store.identities.entries()) store = setPlayerEntityMana(
    store, row.playerId, weakCast && row.playerId === playerId ? 0 : store.progressions[index].maximumMana)
  Object.assign(state, { playerEntities: { ...store,
    progressions: store.progressions.map(row => ({ ...row, currentHealth: row.maximumHealth })) } })
}

function preflightAllPhases(source, playerId) {
  const reports = []
  for (const [name, options] of [...CAST_PHASES,
    ['coarse-targetless', { distance: 360, targets: false, weak: false, coarse: true }],
    ['terminal-main', { distance: 260, targets: true, weak: false, terminal: true }]]) {
    const state = structuredClone(source)
    if (options.coarse) state.enhancedEffects = false
    const planned = planCastFixture(state, playerId, name, options)
    reports.push({ name, angle: planned.angle, ...planned.proof })
  }
  return reports
}

function preflightPhaseSequence(source, playerId, position) {
  let state = structuredClone(source)
  const reports = []
  for (const [name, options] of [...CAST_PHASES,
    ['coarse-targetless', { distance: 360, targets: false, weak: false, coarse: true }],
    ['terminal-main', { distance: 260, targets: true, weak: false, terminal: true }]]) {
    resetControlledFixture(state, playerId, position)
    state.enhancedEffects = !options.coarse
    const planned = planCastFixture(state, playerId, name, options)
    const fixture = prepareCastFixture(state, playerId, name, { ...options, fixtureAngle: planned.angle })
    const input = fixtureHeldInput(state, playerId, fixture)
    const proof = preflightPhase(structuredClone(state), playerId, fixture, options, input)
    for (let tick = 0; tick < 120; tick += 1) {
      refillFixture(state, playerId, options.weak)
      state = stepGameSimulationTick(state, { [playerId]: tick < 90 ? input
        : { ...input, cast: { primary: false, quickbar: null } } })
    }
    assert.ok(state.primarySpells.transients.every(actor => actor.buildId !== 1003), `${name}: sequence did not drain`)
    reports.push({ name, angle: planned.angle, ...proof, afterReleaseTick: state.tick })
  }
  return reports
}

function planCastFixture(source, playerId, name, options) {
  const rejected = []
  for (let angle = 0; angle < 32; angle += 1) {
    try {
      const state = structuredClone(source)
      const fixture = prepareCastFixture(state, playerId, name, { ...options, fixtureAngle: angle })
      return { angle, proof: preflightPhase(state, playerId, fixture, options) }
    } catch (error) {
      if (!['No clear Flame browser fixture placement', 'Targetless fixture unexpectedly acquired a target',
        'Fixture missed native target admission', 'Fixture lacked a real chain birth',
        'Fixture missed short geometry'].some(message => error.message.startsWith(message))) throw error
      rejected.push(`${error.message.split('\n')[0]}${error.actual === undefined ? '' : ` (actual=${JSON.stringify(error.actual)}, expected=${JSON.stringify(error.expected)})`}`)
    }
  }
  throw new Error(`No admitted all-phase Flame fixture for ${name}: ${[...new Set(rejected)].join('; ')}`)
}

function fixtureHeldInput(state, playerId, fixture) {
  const viewport = boundedGameViewportLayout(BROWSER_VIEWPORT.width, BROWSER_VIEWPORT.height,
    { width: state.world.bounds.w, height: state.world.bounds.h }, 1.35)
  const playerIndex = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const position = state.playerEntities.locomotions[playerIndex].position
  const surface = { left: 0, top: 0, ...BROWSER_VIEWPORT }
  const point = {
    x: Math.round((viewport.width / 2 + (fixture.aim.x - position.x) * 1.35) * surface.width / viewport.width),
    y: Math.round((viewport.height / 2 + (fixture.aim.y - position.y) * 1.35) * surface.height / viewport.height),
  }
  const projectedAim = projectNativeWorldPointer(point, surface, viewport,
    { x: position.x - viewport.width / 2 / 1.35, y: position.y - viewport.height / 2 / 1.35 }, 1.35)
  return { aim: projectedAim, cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 }, viewportHeight: viewport.height, viewportWidth: viewport.width }
}

function preflightPhase(source, playerId, fixture, options, actualInput) {
  let state = source
  const input = actualInput ?? fixtureHeldInput(state, playerId, fixture)
  const firstId = state.primarySpells.nextId
  for (let tick = 0; tick < 40; tick += 1) {
    refillFixture(state, playerId, options.weak)
    state = stepGameSimulationTick(state, { [playerId]: input })
    validateFixture(state, playerId)
    const births = state.primarySpells.transients.filter(actor => actor.id >= firstId)
    const ribbons = births.filter(actor => actor.kind === 'weld-channel' && actor.buildId === 1003)
    if (ribbons.length === 0) continue
    const main = ribbons.find(actor => actor.flameVisual?.role === 'main')
    assert.ok(main, 'Fixture lacked a complete real main birth')
    assert.equal(main.underpowered, options.weak)
    assert.equal(main.flameVisual.cameraDisplacement !== null, !options.weak)
    const chains = ribbons.filter(actor => actor.flameVisual?.role === 'chain')
    if (options.targets) {
      assert.equal(main.targetId, 'enemy:1', `Fixture missed native target admission ${JSON.stringify({
        player: state.playerEntities.locomotions[state.playerEntities.identities.findIndex(row => row.playerId === playerId)].position,
        inputAim: input.aim, players: state.playerEntities.locomotions.map(row => row.position),
        enemies: state.world.enemies.actors.map(actor => ({ id: actor.id, position: actor.position,
          lifeState: actor.lifeState, currentHealth: actor.currentHealth })),
      })}`)
      assert.ok(state.world.enemies.actors.some(actor => actor.currentHealth < 100_000), 'Fixture lacked actual contact')
      if (!options.weak) assert.ok(chains.length > 0, 'Fixture lacked a real chain birth')
    } else assert.equal(main.targetId, null, 'Targetless fixture unexpectedly acquired a target')
    if (options.weak) assert.equal(chains.length, 0)
    if (options.distance === 35) assert.equal(main.flameVisual.ribbon.kind, 'short', 'Fixture missed short geometry')
    if (!options.targets) assert.equal(main.flameVisual.ribbon.kind, 'long')
    for (const variant of ['source', 'endpoint']) assert.ok(births.some(actor => actor.kind === 'weld-flame-lash-fade' && actor.variant === variant))
    if (options.terminal) {
      assert.equal(state.world.enemies.actors[0].lifeState, 'dying')
      const burst = births.findIndex(actor => actor.kind === 'fire-explosion')
      const endpoint = births.findIndex(actor => actor.kind === 'weld-flame-lash-fade' && actor.variant === 'endpoint')
      const sourceFade = births.findIndex(actor => actor.kind === 'weld-flame-lash-fade' && actor.variant === 'source')
      assert.ok(burst >= 0 && burst < endpoint && endpoint < sourceFade && sourceFade < births.indexOf(main),
        'Terminal Flame payload must precede endpoint, source and main publication')
    }
    return { tick: state.tick, targetId: main.targetId, weak: main.underpowered,
      mainKind: main.flameVisual.ribbon.kind, chainCount: chains.length,
      terminalPayload: options.terminal === true, enhanced: state.enhancedEffects }
  }
  throw new Error('Fixture preflight never admitted a real Flame birth')
}

function preflightFixture() {
  const config = { discipline: 'arcane', displayName: 'Flame preflight', element: 'fire' }
  let state = createGameSimulation({ owner: config, peer: config })
  const grant = grantPlayerEntityWeldBuild(state.playerEntities, 'owner', 1003, state.gameRng)
  state = { ...state, playerEntities: grant.store, gameRng: grant.rng }
  state = enterBoneyardWorld(state, { choice: { id: 'mod:flame-preflight', modId: 'flame-preflight',
    modName: 'Flame preflight', name: 'Flame preflight', source: 'mod' },
    geometrySha256: 'd'.repeat(64), runId: 'flame-preflight', sourceSha256: 'c'.repeat(64), seed: 'flame-preflight',
    scene: { bounds: { x: 0, y: 0, w: 1000, h: 1000 }, environmentMode: 2, fences: [], name: 'Flame preflight',
      objects: [], roads: [], solomonDig: null, spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [] } })
  clearStartupCombat(state)
  validateFixture(state, 'owner')
  console.log(JSON.stringify({ preflight: 'ok', phases: preflightAllPhases(state, 'owner'),
    startupTuple: [state.world.arenaTransition, state.world.encounter, state.world.waves] }))
}

function preflightStockFixtures() {
  const config = { discipline: 'arcane', displayName: 'Flame stock preflight', element: 'fire' }
  const reports = []
  for (const [index, template] of NATIVE_GENERATED_BONEYARDS.entries()) {
    let state = createGameSimulation({ owner: config, peer: config })
    const grant = grantPlayerEntityWeldBuild(state.playerEntities, 'owner', 1003, state.gameRng)
    state = { ...state, playerEntities: grant.store, gameRng: grant.rng }
    state = enterBoneyardWorld(state, { ...template,
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
      runId: `flame-stock-${index}`, seed: `flame-stock-${index}` })
    clearStartupCombat(state)
    const placement = positionForFixtures(state, 'owner')
    placeFixturePlayer(state, 'owner', placement)
    const phases = preflightPhaseSequence(state, 'owner', placement)
    reports.push({ index, placement, phases })
  }
  console.log(JSON.stringify({ stockPreflight: 'ok', maps: reports.length, reports }))
}

async function capturePrivateCollegeBridge(page, recipient, observer) {
  // Original host/client payloads are forwarded unchanged. This synthetic
  // provisioned WSS URL provides loopback transport, not TLS evidence.
  await page.routeWebSocket('wss://flame-acceptance.invalid/game', route => {
    const socket = new WebSocket(host.address.url, { headers: { origin } }), pending = []
    const receiver = new GameWelcomeReceiver(), replica = new EntityReplicationReconstructor()
    bridges.push(socket)
    route.onMessage(message => {
      const parsed = JSON.parse(typeof message === 'string' ? message : message.toString('utf8'))
      if (parsed.type === 'client-input') {
        recipient.inputs.push({ ordinal: ++recipient.inputOrdinal, input: parsed.input })
        if (recipient.inputs.length > 240) recipient.inputs.shift()
        const check = recipient.pendingInputPreflight
        if (check && !check.checked && parsed.input.cast.primary) {
          check.checked = true
          try {
            check.proof = preflightPhase(structuredClone(host.state()), check.playerId,
              check.fixture, check.options, parsed.input)
          } catch (error) {
            check.error = error.message
            return // An invalid fixture stops here; no altered input is sent.
          }
        }
        if (check?.error) return
      }
      if (socket.readyState === WebSocket.OPEN) socket.send(message)
      else pending.push(message)
    })
    socket.on('open', () => { for (const message of pending) socket.send(message); pending.length = 0 })
    socket.on('message', data => {
      const payload = data.toString()
      try {
        const message = receiver.receivePayload(payload, () => {})
        if (message?.type === 'server-error') errors.wire.push(`${recipient.name}: ${message.message}`)
        if (message?.type === 'server-welcome') {
          assert.equal(message.sessionKind, 'private-college')
          assert.equal(message.observer === true, observer)
          replica.reset(message.snapshot, message.snapshotSequence)
          recipient.latest = message.snapshot
          recipient.welcome = { sessionKind: message.sessionKind, observer: message.observer === true,
            protocolVersion: message.protocolVersion, serverTickRate: message.serverTickRate, snapshotRate: message.snapshotRate }
        }
        if (message?.type === 'server-snapshot') {
          recipient.latest = replica.apply(message.frame, message.sequence)
          const live = new Set(recipient.latest.primarySpells.transients.map(actor => actor.id))
          for (const birth of message.frame.flamePresentation.births) {
            recipient.births.set(birth.id, birth)
            if (!live.has(birth.id)) recipient.historyOnlyBirths.add(birth.id)
          }
        }
      } catch (error) { errors.wire.push(`${recipient.name}: ${error.message}`) }
      route.send(payload)
    })
    socket.on('error', error => errors.wire.push(`${recipient.name} bridge: ${error.message}`))
    socket.on('close', () => { receiver.close(); route.close() })
    route.onClose(() => socket.close())
  })
}
