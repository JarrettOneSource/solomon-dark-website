import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { createNativeFacultyAction } from '../src/game/core-kernels/native-faculty-actions.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { createNativeSecondaryPlayerState } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from '../src/game/core-kernels/native-survival-boss-catalog.ts'
import { nativeDiscorporealRecipe } from '../src/game/core-kernels/native-survival-discorporeal.ts'
import { nativeFacultyRecipe } from '../src/game/core-kernels/native-survival-faculty.ts'
import { nativeHeartmongerRecipe } from '../src/game/core-kernels/native-survival-heartmonger.ts'
import { nativePortalProgram, nativePortalRecipe } from '../src/game/core-kernels/native-survival-portal.ts'
import { nativeSkeletonBossRecipe } from '../src/game/core-kernels/native-survival-skeleton-bosses.ts'
import { nativeSlumpgutRecipe } from '../src/game/core-kernels/native-survival-slumpgut.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { canPlaceBoneyardBody, firstBoneyardPathBlockProgress } from '../src/game/core-server/boneyard-collision.ts'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { createGameSimulation, enterBoneyardWorld, gameSimulationPlayerRecords } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { gameSnapshot } from '../src/game/protocol/codecs/snapshot.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.SDR_BOSS_PROOF_OUTPUT || '/tmp/solomon-native-bosses'
const selectedCase = process.argv.find(argument => argument.startsWith('--case='))?.slice(7)
const fromCase = process.argv.find(argument => argument.startsWith('--from='))?.slice(7)
const character = { discipline: 'arcane', element: 'fire', displayName: 'Boss acceptance' }
const catalog = createBoneyardCatalog()
const loaded = materializeBoneyard(catalog, 'default-random', Buffer.alloc(16, 42))
assert.ok(loaded)
const cases = [
  ...['claw', 'sword', 'mace', 'flail'].map((weapon, index) => ({ id: `ironmaw-${weapon}`, name: 'Ironmaw', token: 'SKELETON', weapon: index, fireAtBoss: true })),
  { id: 'foulshaft', name: 'Foulshaft', token: 'SKELETONARCHER', projectiles: ['arrow'] },
  { id: 'heartmonger', name: 'Heartmonger', token: 'HEARTMONGER', crows: 5 },
  ...['Dire Sirmin', 'Dire Aliss', 'Dire Lucritius'].flatMap((name, index) => [
    { id: `faculty-${index}-primary`, name, token: 'DIREFACULTY', action: 'primary',
      spells: [['skull-missile'], ['blightning'], ['dark-fireball']][index] },
    { id: `faculty-${index}-secondary`, name, token: 'DIREFACULTY', action: 'secondary',
      spells: [['rain-of-bones'], ['tragic-circle'], ['dark-fireball']][index] },
  ]),
  { id: 'discorporeal-eyes', name: 'The Discorporeal', token: 'DEMONSKULL', action: 'eyes', spells: ['eye-laser'] },
  { id: 'discorporeal-mouth', name: 'The Discorporeal', token: 'DEMONSKULL', action: 'mouth', spells: ['mouth-beam-segment', 'green-fire'], damaged: true, milliseconds: 8500 },
  { id: 'discorporeal-spit', name: 'The Discorporeal', token: 'DEMONSKULL', action: 'spit', spells: ['unholy-spit', 'green-fire'], imps: true },
  { id: 'discorporeal-flair', name: 'The Discorporeal', token: 'DEMONSKULL', action: 'flair' },
  { id: 'slumpgut', name: 'Slumpgut', token: 'ZOMBIE' },
  { id: 'deep-portal', token: 'PORTAL', portal: true, milliseconds: 8000 },
  { id: 'heartmonger-death', name: 'Heartmonger', token: 'HEARTMONGER', death: true, detachedCrows: true,
    spells: ['heartmonger-flicker', 'heartmonger-soul'], milliseconds: 11500 },
  ...['Dire Sirmin', 'Dire Aliss', 'Dire Lucritius'].map((name, index) => ({
    id: `faculty-${index}-death`, name, token: 'DIREFACULTY', death: true, milliseconds: 6500,
  })),
  { id: 'discorporeal-death', name: 'The Discorporeal', token: 'DEMONSKULL', death: true, spells: ['ultra-banish'], milliseconds: 8500 },
  { id: 'discorporeal-mega', name: 'The Discorporeal', token: 'DEMONSKULL', death: true, mega: true, spells: ['ultra-banish', 'unholy-soul'], milliseconds: 8500 },
]
assert.ok(!selectedCase || cases.some(row => row.id === selectedCase), 'Unknown boss acceptance case')
const startIndex = fromCase ? cases.findIndex(row => row.id === fromCase) : 0
assert.ok(startIndex >= 0 && !(selectedCase && fromCase), 'Use a known starting case or one selected case')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: resolve(frontend, '../backend/wwwroot') })
const receipts = []
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', executablePath: process.env.SDR_CHROME_PATH, headless: true })
  for (const row of cases.slice(startIndex).filter(row => !selectedCase || row.id === selectedCase)) {
    const receipt = await acceptBoss(row)
    receipts.push(receipt)
    await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipts, null, 2))
    console.log(JSON.stringify(receipt))
  }
} finally {
  await browser?.close()
  await server.close()
}

function recipe(row) {
  const sha = row.weapon === undefined ? loaded.sourceSha256
    : NATIVE_SURVIVAL_BOSS_SOURCES.find(source => source.ironmawWeapon === row.weapon).sourceSha256
  if (row.token === 'SKELETON' || row.token === 'SKELETONARCHER') return nativeSkeletonBossRecipe(sha, row.name)
  if (row.token === 'HEARTMONGER') return nativeHeartmongerRecipe(sha)
  if (row.token === 'DIREFACULTY') return nativeFacultyRecipe(sha, row.name)
  if (row.token === 'DEMONSKULL') return nativeDiscorporealRecipe(sha)
  if (row.token === 'ZOMBIE') return nativeSlumpgutRecipe(sha)
  return nativePortalRecipe(nativePortalProgram(sha).phases[0])
}

function fixture(row) {
  let state = enterBoneyardWorld(createGameSimulation({ proof: character }), loaded)
  const world = state.world
  const point = clearLocation(world, row.fireAtBoss ? 75 : 200)
  const current = gameSimulationPlayerRecords(state).proof
  state = { ...state, playerEntities: replacePlayerCharacter(state.playerEntities, 'proof', { ...current,
    position: point.player, headingIndex: 12 }), world: { ...world, encounter: null, waves: null, arenaTransition: null,
      lanternPosition: { x: point.player.x, y: (point.player.y + point.boss.y) / 2 } },
    // Keep the observer alive through every attack using the existing shield state.
    secondaryAbilities: { ...state.secondaryAbilities, players: { proof: { ...createNativeSecondaryPlayerState(),
      magicShieldAbsorb: 1000000, magicShieldMaximum: 1000000 } } } }
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const authored = recipe(row)
  let enemies = stepBoneyardEnemyStore(state.world.enemies, { tick: 0, players: {},
    projectileWorldBlocked: () => false, resolveMovement: request => request.requestedPosition,
    registerWorldPainter: order.register, resolveSpawnIntents: () => [{ authoredRecipe: authored,
      enemyToken: row.token, nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[row.token], flags: [], id: 1,
      enableDiscorporealHealthGates: row.token === 'DEMONSKULL', locationPolicy: 'anywhere', position: point.boss, spawnTick: 0, waveOrdinal: 38 }],
  }).store
  enemies = { ...enemies, actors: enemies.actors.map(actor => {
    let brain = actor.brain
    if (brain.family === 'demon-skull') brain = { ...brain, bodyHeadingDeg: 0, seen: true,
      capabilities: row.mega ? 16 : row.action === 'flair' ? 32 : row.action === 'spit' ? 8 : 0,
      pendingAttack: ['eyes', 'mouth', 'spit'].includes(row.action) ? row.action : null,
      speed: row.action ? 0 : brain.speed, targetSpeed: row.action ? Math.fround(.0001) : brain.targetSpeed }
    if (brain.family === 'faculty' && row.action) {
      const kind = row.action === 'secondary' ? 'two-hand' : actor.config.family.primary === 1 ? 'lightning' : 'throw'
      const action = createNativeFacultyAction(kind, createNativeRng(19)).action
      brain = { ...brain, action, primaryPoll: 10000, handMask: action.handMask, phase: 'cast' }
    }
    return { ...actor, brain, headingDeg: 0 }
  }) }
  if (row.death || row.damaged) enemies = damageBoneyardEnemy(enemies, { actorId: 1,
    amount: authored.maximumHealth * (row.death ? 2 : .5), sourcePlayerId: row.death ? null : 'proof',
    hasMagicDamage: row.death && (row.token === 'HEARTMONGER' || row.token === 'DIREFACULTY'), tick: 0 }).store
  state = { ...state, world: { ...state.world, enemies }, worldManagerOrder: order.state() }
  gameSnapshot(createGameSnapshot(state, 'proof'))
  const document = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: loaded,
    mods: [], modState: {}, playerId: 'proof', state })
  restoreGameSaveDocument(document)
  return { document, name: authored.name, position: point.boss, initialHealth: enemies.actors[0].currentHealth }
}

function clearLocation(world, distance) {
  const { x, y, w, h } = world.bounds
  let best = null
  for (let py = y + 260; py < y + h - distance - 260; py += 60) {
    for (let px = x + 260; px < x + w - 260; px += 60) {
      const player = { x: px, y: py }
      const boss = { x: px, y: py + distance }
      if (!canPlaceBoneyardBody(player, world.bounds, world.collision, 40)
        || !canPlaceBoneyardBody(boss, world.bounds, world.collision, 65)
        || firstBoneyardPathBlockProgress(player, boss, world.bounds, world.collision, 25) !== null) continue
      const nearest = Math.min(...loaded.scene.objects.map(object => Math.hypot(object.pos.x - px, object.pos.y - (py + distance / 2))
        - ([2001, 2040].includes(object.typeId) ? 160 : 25)))
      const score = nearest - Math.hypot(px - x - w / 2, py - y - h / 2) * .1
      if (!best || score > best.score) best = { boss, player, score }
    }
  }
  assert.ok(best, 'The stock map must provide an unobstructed acceptance location')
  return best
}

async function acceptBoss(row) {
  const seeded = fixture(row)
  const credential = randomBytes(24).toString('base64url')
  const host = await startGameHost({ authentication: { kind: 'shared', credential }, allowedOrigins: [server.origin],
    boneyards: catalog, host: '127.0.0.1', port: 0, snapshotRate: 20, luaWasmPath: resolve(frontend, 'dist-game-host/lua54.wasm') })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const page = await context.newPage()
  const errors = { page: [], console: [], responses: [], requests: [] }
  const capturedEffects = new Set()
  const observed = { spells: new Set(), projectiles: new Set(), crows: 0, detachedCrows: 0, imps: 0,
    minimumHealth: seeded.initialHealth, retired: false, capabilities: 0 }
  const interval = setInterval(() => {
    const world = host.state().world
    if (world.kind !== 'boneyard') return
    for (const spell of world.enemies.bossSpells) observed.spells.add(spell.kind)
    for (const projectile of world.enemies.projectiles) observed.projectiles.add(projectile.kind)
    const boss = world.enemies.actors.find(actor => actor.id === 1)
    observed.retired ||= !boss
    if (boss) observed.minimumHealth = Math.min(observed.minimumHealth, boss.currentHealth)
    if (boss?.brain.family === 'heartmonger') observed.crows = Math.max(observed.crows, boss.brain.crows.length)
    if (boss?.brain.family === 'demon-skull') observed.capabilities |= boss.brain.capabilities
    observed.detachedCrows = Math.max(observed.detachedCrows, world.enemies.detachedCrows.length)
    observed.imps = Math.max(observed.imps, world.enemies.actors.filter(actor => actor.config.nativeTypeId === 2044).length)
  }, 10)
  const captureActiveEffects = async () => {
    const world = host.state().world
    if (world.kind !== 'boneyard') return
    const effects = [...(row.spells ?? []).filter(kind => world.enemies.bossSpells.some(spell => spell.kind === kind)),
      ...(row.projectiles ?? []).filter(kind => world.enemies.projectiles.some(projectile => projectile.kind === kind))]
    for (const kind of effects) {
      if (capturedEffects.has(kind)) continue
      await page.waitForTimeout(60)
      await page.screenshot({ path: resolve(output, `${row.id}-${kind}.png`) })
      capturedEffects.add(kind)
    }
  }
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
  try {
    await page.addInitScript(installGameAudioSmokeProbe)
    await page.addInitScript(({ credential, url, save, character }) => {
      const OriginalWebSocket = window.WebSocket
      window.WebSocket = new Proxy(OriginalWebSocket, { construct(Target, args) {
        const socket = new Target(...args)
        const send = socket.send.bind(socket)
        socket.send = data => {
          if (typeof data === 'string') {
            const message = JSON.parse(data)
            if (message.type === 'client-hello') {
              delete message.beginCollegeIntro; delete message.declineTutorial; delete message.resumeToken
              return send(JSON.stringify({ ...message, save, saveIntent: 'resume', character }))
            }
          }
          return send(data)
        }
        return socket
      } })
      window.solomonDarkRuntime = { gameEndpoint: { credential, kind: 'localhost', sessionKind: 'standalone', url } }
      window.__bossFrames = []
      const sample = () => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        if (frame) window.__bossFrames.push({ frame: frame.frameCount, enemies: frame.enemySamples.map(row => ({ ...row })),
          deathEffects: frame.enemyDeathEffectCount, underlays: frame.enemyUnderlayLayerCount,
          projectileCount: frame.enemyProjectileCount, auxiliary: frame.enemyAuxiliaryEffectCount })
        if (window.__bossFrames.length > 2400) window.__bossFrames.shift()
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }, { credential, url: host.address.url, save: seeded.document, character })
    await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90000 })
    const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
    if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: /fire/i }).click()
    await page.locator('.create-menu-discipline-arcane').click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90000 })
    await page.locator('[data-gameplay-resume-grace-phase]').waitFor({ state: 'hidden', timeout: 30000 })
    await page.waitForFunction(() => document.querySelector('.main-menu-scene')?.getAttribute('data-gameplay-resume-grace') !== 'load-game')
    // A resumed attack can be in flight before the general start capture finishes.
    await captureActiveEffects()
    const bar = page.locator('[data-native-ui-clip="boss-health-fill"]')
    let barBounds = null
    let resizedBar = null
    if (row.death) assert.equal(await bar.count(), 0)
    else {
      await page.getByRole('meter', { name: seeded.name, exact: true }).waitFor({ state: 'attached', timeout: 10000 })
      await bar.waitFor({ state: 'visible', timeout: 10000 })
      barBounds = await bar.boundingBox()
      assert.ok(barBounds && Math.abs(barBounds.y - 791) <= 1 && Math.abs(barBounds.height - 11) <= 1)
    }
    await page.screenshot({ path: resolve(output, `${row.id}-start.png`) })
    const aimAtBoss = async () => {
      const aim = await page.evaluate(() => {
        const canvas = document.querySelector('.boneyard-world-canvas')
        const frame = canvas.__sdrBoneyardFrame
        const position = frame.enemySamples.find(enemy => enemy.id === 1)
        if (!position) return null
        const rect = canvas.getBoundingClientRect()
        return { x: rect.left + rect.width / 2 + (position.x - frame.cameraX) * frame.cameraZoom,
          y: rect.top + rect.height / 2 + (position.y - frame.cameraY) * frame.cameraZoom }
      })
      if (aim) await page.mouse.move(aim.x, aim.y)
    }
    if (row.fireAtBoss) {
      await aimAtBoss()
      await page.mouse.down()
    }
    const milliseconds = row.milliseconds ?? 5500
    for (const part of [0, 1]) {
      const end = Date.now() + milliseconds / 2
      while (Date.now() < end) {
        if (row.fireAtBoss) await aimAtBoss()
        await captureActiveEffects()
        await page.waitForTimeout(50)
      }
      await page.screenshot({ path: resolve(output, `${row.id}-${part === 0 ? 'active' : 'end'}.png`) })
    }
    await page.mouse.up()
    for (const kind of row.spells ?? []) assert.ok(observed.spells.has(kind) && capturedEffects.has(kind), `${row.id}: missing ${kind} capture`)
    for (const kind of row.projectiles ?? []) assert.ok(observed.projectiles.has(kind) && capturedEffects.has(kind), `${row.id}: missing ${kind} capture`)
    if (row.crows) assert.equal(observed.crows, row.crows)
    if (row.detachedCrows) assert.ok(observed.detachedCrows > 0)
    if (row.imps) assert.ok(observed.imps > 0)
    if (row.death) assert.ok(observed.retired, `${row.id}: boss did not retire`)
    if (row.fireAtBoss) assert.ok(observed.minimumHealth < seeded.initialHealth, `${row.id}: live player cast did not hit the boss`)
    if (row.damaged) assert.equal(observed.capabilities & 3, 3)
    const rendered = await page.evaluate(() => {
      const samples = window.__bossFrames.flatMap(frame => frame.enemies).filter(enemy => enemy.id === 1)
      return { frames: window.__bossFrames.length, samples: samples.length,
        poses: [...new Set(samples.map(enemy => `${enemy.bodyEntry}/${enemy.limbsEntry}/${enemy.bodyPose}/${enemy.gaitPose}/${enemy.x}/${enemy.y}`))].length,
        families: [...new Set(samples.map(enemy => enemy.enemyToken))],
        peakDeathEffects: Math.max(0, ...window.__bossFrames.map(frame => frame.deathEffects)),
        peakUnderlays: Math.max(0, ...window.__bossFrames.map(frame => frame.underlays)),
        audio: [...new Set(window.__sdrAudioPlaySources)].map(source => new URL(source, location.href).pathname.split('/').pop()),
      }
    })
    assert.ok(rendered.frames > 30, `${row.id}: missing rendered frames`)
    // Heartmonger retires on its first death update; its children own the complete finale.
    if (!row.death || row.token !== 'HEARTMONGER') {
      assert.ok(rendered.samples > 0 && rendered.poses > 1, `${row.id}: missing live animation frames`)
    }
    if (row.death) assert.ok(rendered.peakDeathEffects > 0)
    const expectedAudio = row.death ? row.token === 'DEMONSKULL' ? 'unholy-die' : row.token === 'HEARTMONGER' ? 'heart-break' : 'faculty-die'
      : row.action === 'flair' ? 'unholy-scream' : row.action === 'spit' ? 'unholy-spits'
      : row.action === 'eyes' || row.action === 'mouth' ? 'eye-laser-charge'
      : row.token === 'DIREFACULTY' ? row.action === 'secondary'
        ? ({ 'Dire Sirmin': 'magic-storm', 'Dire Aliss': 'magic-circle', 'Dire Lucritius': 'big-fire' }[row.name])
        : row.name === 'Dire Aliss' ? 'lightning-start' : 'throw-dark'
      : row.token === 'SKELETONARCHER' ? 'shoot-arrow' : row.fireAtBoss ? 'throw-fire' : null
    if (expectedAudio) assert.ok(rendered.audio.some(source => source === `${expectedAudio}.wav` || source.startsWith(`${expectedAudio}-`)),
      `${row.id}: missing real ${expectedAudio} playback`)
    if (row.id === 'discorporeal-mouth') {
      await page.setViewportSize({ width: 960, height: 640 })
      await page.waitForTimeout(200)
      const resized = await bar.boundingBox()
      const scaling = await page.locator('.boneyard-scene').evaluate(element => ({
        display: Number(element.dataset.viewportScale), ui: Number(element.dataset.uiScale),
      }))
      assert.equal(scaling.display, .6)
      assert.equal(scaling.ui, 1)
      const scale = scaling.display * scaling.ui
      assert.ok(resized && Math.abs(resized.y - (640 - 109 * scale)) <= 1
        && Math.abs(resized.height - 11 * scale) <= 1, JSON.stringify({ resized, scale }))
      resizedBar = { ...resized, ...scaling }
      await page.screenshot({ path: resolve(output, `${row.id}-resized.png`) })
    }
    assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
    return { id: row.id, name: seeded.name, position: seeded.position, barBounds, resizedBar, rendered, capturedEffects: [...capturedEffects],
      observed: { ...observed, spells: [...observed.spells], projectiles: [...observed.projectiles] }, errors }
  } catch (error) {
    await page.screenshot({ path: resolve(output, `${row.id}-failure.png`) }).catch(() => {})
    await writeFile(resolve(output, `${row.id}-failure.json`), JSON.stringify({ error: String(error), errors,
      observed: { ...observed, spells: [...observed.spells], projectiles: [...observed.projectiles] } }, null, 2))
    throw error
  } finally {
    clearInterval(interval)
    await context.close()
    await host.close()
  }
}
