import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { bindNativeBeltSkill } from '../src/game/core-kernels/native-belt.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { resetNativeSecondaryWorld } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from '../src/game/core-kernels/native-survival-boss-catalog.ts'
import { nativeSkeletonBossRecipe } from '../src/game/core-kernels/native-survival-skeleton-bosses.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { canPlaceBoneyardBody, firstBoneyardPathBlockProgress } from '../src/game/core-server/boneyard-collision.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { grantPlayerEntitySkillRanks, replacePlayerCharacter, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'
import { observeGoldPlacementWire } from './smoke-loot-gold-placement.mjs'

const output = process.env.SDR_FIREWALKER_OUTPUT || '/tmp/solomon-firewalker-movement'
const baseline = process.env.SDR_REACTION_BASELINE === '1'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const credential = randomBytes(32).toString('base64url')
const errors = { page: [], console: [], responses: [], requests: [], host: [] }
const host = await startGameHost({ allowedOrigins: [origin],
  authentication: { kind: 'shared', credential }, createBoneyardSeedBytes: () => Buffer.alloc(16),
  snapshotRate: 20, log: entry => { if (entry.level === 'error') errors.host.push(entry) },
})
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
})
let refill
const receipts = []
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const wire = observeGoldPlacementWire(page, host.address.url)
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(response.url()) })
  page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
  await page.route('**/deployment.json*', route => route.fulfill({ json: {
    revision: new URL(route.request().url()).searchParams.get('current'),
  } }))
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
    { credential, kind: 'localhost', url: host.address.url })
  await enterElementHub(page, origin, 'Fire')
  await enterBoneyard(page)
  const playerId = host.hostPlayerId()
  await openBoneyardCombat(host, playerId)
  const location = clearLocation(host.state().world)
  preparePlayer(playerId)
  refill = setInterval(() => {
    const state = host.state()
    const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
    if (index < 0) return
    const store = setPlayerEntityMana(state.playerEntities, playerId, state.playerEntities.progressions[index].maximumMana)
    Object.assign(state, { playerEntities: { ...store, progressions: store.progressions.map(p => ({
      ...p, currentHealth: p.maximumHealth,
    })) } })
  }, 50)

  const cases = ['claw', 'sword', 'mace', 'flail'].map((weapon, index) => ({
    id: `ironmaw-${weapon}`, name: 'Ironmaw', token: 'SKELETON', type: 1001,
    sha: NATIVE_SURVIVAL_BOSS_SOURCES.find(source => source.ironmawWeapon === index).sourceSha256,
  }))
  cases.push({ id: 'foulshaft', name: 'Foulshaft', token: 'SKELETONARCHER', type: 1002,
    sha: NATIVE_SURVIVAL_BOSS_SOURCES[0].sourceSha256 })
  for (const row of cases) {
    clearFixture()
    movePlayer(playerId, location.fire)
    await page.waitForTimeout(150)
    await page.keyboard.press('1')
    await waitUntil(() => host.state().secondaryAbilities.players[playerId]?.firewalker === true,
      'Actual Firewalker key did not activate', 5000)
    await waitUntil(() => host.state().secondaryAbilities.actors.some(actor => actor.kind === 'fire-patch'),
      'Firewalker did not create an authored fire patch', 5000)
    const patch = host.state().secondaryAbilities.actors.find(actor => actor.kind === 'fire-patch')
    const firePosition = { ...patch.position }
    movePlayer(playerId, location.target)
    const bossId = spawnBoss(row, firePosition)
    const boss = () => host.state().world.enemies.actors.find(actor => actor.id === bossId)
    const birthHealth = boss().currentHealth
    await waitUntil(() => boss()?.currentHealth < birthHealth,
      `${row.id}: the actual fire patch never contacted the boss`, 5000)
    const initial = structuredClone(boss())
    const samples = []
    const started = host.state().tick
    const sample = () => {
      const actor = boss()
      if (actor) samples.push({ tick: host.state().tick, position: { ...actor.position },
        health: actor.currentHealth, visualHit: actor.hitFeedback.timer,
        reaction: actor.hitReactionTimer ?? null, phase: actor.brain.phase,
        gait: actor.gaitPose, actionProgress: actor.brain.actionProgress,
      })
    }
    sample()
    const sampling = setInterval(sample, 10)
    try {
      await waitUntil(() => host.state().tick >= started + 100, 'Active contact trial stalled', 10000)
      sample()
      const active = samples.filter(s => s.tick <= started + 100)
      const displacement = Math.max(...active.map(s => Math.hypot(
        s.position.x - initial.position.x, s.position.y - initial.position.y)))
      const healthDamage = initial.currentHealth - Math.min(...active.map(s => s.health))
      assert.ok(healthDamage > 0, `${row.id}: no actual fire damage reached the boss`)
      assert.ok(active.some(s => s.visualHit > 0), `${row.id}: no visual hit was observed`)
      if (baseline) assert.equal(displacement, 0, `${row.id}: baseline did not reproduce the stall`)
      else assert.ok(displacement > 10, `${row.id}: boss did not move while Firewalker damaged it`)
      await page.screenshot({ path: `${output}/${row.id}-active.png` })
      await waitUntil(() => wire.snapshot?.world.kind === 'boneyard'
        && wire.snapshot.world.enemies.some(actor => actor.id === bossId), 'Boss not replicated', 5000)
      const wireBoss = wire.snapshot.world.enemies.find(actor => actor.id === bossId)
      const replicatedDisplacement = Math.hypot(wireBoss.position.x - initial.position.x,
        wireBoss.position.y - initial.position.y)
      if (!baseline) assert.ok(replicatedDisplacement > 10, `${row.id}: corrected motion did not reach the client`)
      let attack = null
      if (!baseline) {
        movePlayer(playerId, { x: location.fire.x, y: location.fire.y + 200 })
        await waitUntil(() => boss()?.brain.phase === 'attack' && boss().brain.actionProgress > 0,
          `${row.id}: did not perform an ordinary attack after leaving the fire`, 12000)
        attack = { phase: boss().brain.phase, progress: boss().brain.actionProgress, tick: host.state().tick }
        await page.waitForFunction(position => {
          const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
          return frame && Math.hypot(frame.cameraFocusX - position.x, frame.cameraFocusY - position.y) < 2
        }, getPlayerCharacter(host.state(), playerId).position, { timeout: 5000 })
        await page.waitForFunction(id => {
          const canvas = document.querySelector('.boneyard-world-canvas')
          const frame = canvas?.__sdrBoneyardFrame
          if (!frame?.enemySamples.some(enemy => enemy.id === id && enemy.action !== null
            && enemy.actionProgress > 0)) return false
          canvas.__firewalkerAttackCapture = structuredClone({
            camera: { x: frame.cameraFocusX, y: frame.cameraFocusY }, enemies: frame.enemySamples,
          })
          return true
        }, bossId, { timeout: 10000 })
        const rendered = await page.locator('.boneyard-world-canvas').evaluate(node => node.__firewalkerAttackCapture)
        attack.rendered = rendered
        await page.screenshot({ path: `${output}/${row.id}-attacking.png` })
      }
      const receipt = { id: row.id, bossId, healthDamage, displacement, baseline,
        unchangedMaximumHealth: boss().config.maximumHealth === initial.config.maximumHealth,
        sampledTicks: active.at(-1).tick - started,
        wireBoss: { id: wireBoss.id, position: wireBoss.position, replicatedDisplacement }, attack,
        samples: active,
      }
      receipts.push(receipt)
      await writeFile(`${output}/${row.id}.json`, JSON.stringify(receipt, null, 2))
    } finally { clearInterval(sampling) }
  }
  assert.deepEqual(wire.errors, [])
  assert.ok(Object.values(errors).every(values => values.length === 0), JSON.stringify(errors))
  const result = { browser: browser.version(), baseline, errors, wireErrors: wire.errors,
    fixture: 'Actual Firewalker key; authored boss recipes; fixed collision-safe generated-arena placements; player health/mana replenished; wave spawns held',
    receipts: receipts.map(({ samples, ...receipt }) => receipt) }
  await writeFile(`${output}/receipt.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(JSON.stringify({ message: error.message, errors, receipts }))
  throw error
} finally {
  clearInterval(refill)
  await browser.close(); await host.close(); await frontend.close()
}

function clearFixture() {
  const state = host.state(), world = state.world
  assert.equal(world.kind, 'boneyard')
  Object.assign(state, { secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    world: { ...world, enemies: createBoneyardEnemyStore('firewalker-proof'), enemyEvents: [],
      encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
      waves: { ...world.waves, phase: 'interwave', interwaveDelayTicks: 100000,
        portalScriptPhase: 'retired', slumpgutPhase: 'retired',
        bossEncounters: world.waves.bossEncounters.map(encounter => ({ ...encounter, phase: 'retired' })) },
    } })
}

function spawnBoss(row, position) {
  const state = host.state(), order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore(row.id), {
    tick: state.tick, players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: order.register, resolveMovement: request => request.requestedPosition,
    resolveSpawnIntents: () => [{ authoredRecipe: nativeSkeletonBossRecipe(row.sha, row.name),
      enemyToken: row.token, nativeTypeId: row.type, flags: [], id: 1, locationPolicy: 'anywhere',
      position, spawnTick: state.tick, waveOrdinal: 20 }],
  })
  assert.equal(spawned.store.actors.length, 1)
  Object.assign(state, { world: { ...state.world, enemies: spawned.store }, worldManagerOrder: order.state() })
  return spawned.store.actors[0].id
}

function preparePlayer(playerId) {
  const state = host.state()
  let store = state.playerEntities, rng = createNativeRng(42)
  for (const [skill, rank] of [[23, 1], [56, 4]]) {
    const index = store.identities.findIndex(row => row.playerId === playerId)
    const amount = Math.max(0, rank - store.skillBooks[index].permanentRanks[skill])
    if (!amount) continue
    const granted = grantPlayerEntitySkillRanks(store, playerId, skill, amount, rng)
    store = granted.store; rng = granted.rng
  }
  const index = store.identities.findIndex(row => row.playerId === playerId)
  const belts = [...store.belts]
  belts[index] = bindNativeBeltSkill(belts[index], store.skillBooks[index], 23, 1)
  Object.assign(state, { playerEntities: { ...store, belts,
    progressions: store.progressions.map(p => ({ ...p, level: 75 })) } })
}

function movePlayer(playerId, position) {
  const state = host.state(), player = getPlayerCharacter(state, playerId)
  Object.assign(state, { playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
    ...player, position: { ...position }, velocity: { x: 0, y: 0 },
  }) })
}

function clearLocation(world) {
  const { x, y, w, h } = world.bounds
  let best = null
  for (let py = y + 150; py < y + h - 650; py += 60) {
    for (let px = x + 150; px < x + w - 150; px += 60) {
      const fire = { x: px, y: py }, target = { x: px, y: py + 500 }
      if (canPlaceBoneyardBody(fire, world.bounds, world.collision, 65)
        && canPlaceBoneyardBody(target, world.bounds, world.collision, 40)
        && firstBoneyardPathBlockProgress(fire, target, world.bounds, world.collision, 30) === null) {
        const score = Math.hypot(px - x - w / 2, py + 250 - y - h / 2)
        if (best === null || score < best.score) best = { fire, target, score }
      }
    }
  }
  if (best === null) throw new Error('No stock collision-safe trial location')
  return best
}
