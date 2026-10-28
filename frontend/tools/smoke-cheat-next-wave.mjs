import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import { NATIVE_RETAIL_WAVES } from '../src/game/core-kernels/native-retail-wave-schedule.ts'
import { createBoneyardCollisionWorld } from '../src/game/core-server/boneyard-collision.ts'
import { findBoneyardEnemyRoute } from '../src/game/core-server/boneyard-enemy-navigation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { enterBoneyard, openBoneyardCombat, startElementHub, waitUntil } from './game-smoke-navigation.mjs'
import { observeGoldPlacementWire } from './smoke-loot-gold-placement.mjs'

const live = process.argv.includes('--live')
const output = process.env.SDR_NEXT_WAVE_OUTPUT
assert.ok(output, 'SDR_NEXT_WAVE_OUTPUT must name the task evidence directory')
await mkdir(output, { recursive: true })
const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const frontend = live ? null : await preview({ root: frontendRoot,
  configFile: `${frontendRoot}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
})
const origin = live ? (process.env.SDR_NEXT_WAVE_LIVE_URL || 'https://solomondarker.com')
  : `http://127.0.0.1:${frontend.httpServer.address().port}`
const errors = { page: [], console: [], requests: [], responses: [], host: [] }
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.SDR_CHROME_PATH,
})
const journeys = []
try {
  for (const touch of [false, true]) {
    const credential = randomBytes(32).toString('base64url')
    const host = live ? null : await startGameHost({ allowedOrigins: [origin],
      authentication: { kind: 'shared', credential }, snapshotRate: 20,
      luaWasmPath: fileURLToPath(new URL('../dist-game-host/lua54.wasm', import.meta.url)),
      createBoneyardSeedBytes: () => Buffer.alloc(16),
      log: entry => { if (entry.level === 'error') errors.host.push(entry) },
    })
    const context = await browser.newContext({
      viewport: touch ? { width: 844, height: 390 } : { width: 1600, height: 900 },
      hasTouch: touch,
    })
    try {
      const page = await context.newPage()
      const wire = observeGoldPlacementWire(page, host?.address.url)
      page.on('pageerror', error => errors.page.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
      page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
      page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
      if (host) await page.addInitScript(gameEndpoint => {
        window.solomonDarkRuntime = { gameEndpoint }
      }, { credential, kind: 'localhost', url: host.address.url })
      await page.goto(`${origin}/game`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
      const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
      if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      const settings = page.locator('[data-native-ui-settings] [role="dialog"]')
      await settings.getByRole('button', { name: 'ONLINE AND ACCOUNT', exact: true }).click()
      const cheats = settings.getByRole('button', { name: 'ENABLE CHEATS', exact: true })
      assert.equal(await cheats.getAttribute('aria-pressed'), 'false')
      await cheats.click()
      await settings.getByRole('button', { name: 'BACK', exact: true }).click()
      await settings.getByRole('button', { name: 'DONE', exact: true }).click()
      await startElementHub(page, 'Fire')
      await page.waitForFunction(() => window.solomonDark?.lua)
      const menu = page.getByRole('dialog', { name: 'Cheat menu' })
      await page.keyboard.press('Backquote')
      await menu.waitFor()
      const next = menu.getByRole('button', { name: 'NEXT WAVE SPAWN', exact: true })
      assert.equal(await next.isEnabled(), false)
      await menu.getByRole('tab', { name: 'CONSOLE', exact: true }).click()
      await menu.getByRole('textbox', { name: 'LUA', exact: true }).fill('return sd.waves.spawn_next()')
      await menu.getByRole('button', { name: 'RUN LUA', exact: true }).click()
      const hubRejection = menu.locator('[data-console-result="error"]').first()
      await hubRejection.waitFor()
      assert.match(await hubRejection.textContent(), /active survival wave/)
      await menu.getByRole('tab', { name: 'CHEATS', exact: true }).click()
      assert.equal((await lua(page, 'return sd.rng.set_seed(42)')).ok, true)
      await menu.getByRole('button', { name: 'Close cheat menu' }).click()
      await enterBoneyard(page)
      const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
      await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
      await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]')
        .waitFor({ timeout: 30_000 })
      await page.keyboard.press('Backquote')
      await menu.waitFor()
      assert.equal(await next.isEnabled(), false)
      // Keep the testing player alive through ordinary admitted health commands.
      assert.equal((await lua(page, "return sd.events.on('runtime.tick', function() sd.player.restore_health(10000000) end)")).ok, true)
      await menu.getByRole('button', { name: 'Close cheat menu' }).click()
      if (host) await openBoneyardCombat(host, host.hostPlayerId())
      else await walkToSolomon(page, scene, wire)
      await page.waitForFunction(() => document.querySelector('.boneyard-scene')?.getAttribute('data-wave-phase') === 'opening-threshold', undefined, { timeout: 60_000 })
      await page.keyboard.press('Backquote')
      await menu.waitFor()
      const starts = []
      for (let index = 0; index < 2; index += 1) {
        await waitUntil(() => wire.snapshot?.world.kind === 'boneyard'
          && wire.snapshot.world.waves?.pendingSpawnBudget === 0, 'Authored births did not finish', 60_000)
        await next.waitFor()
        await page.waitForFunction(() => [...document.querySelectorAll('.cheat-menu-action')]
          .find(button => button.textContent === 'NEXT WAVE SPAWN')?.disabled === false)
        assert.equal(await next.isEnabled(), true)
        const before = structuredClone(wire.snapshot.world)
        if (touch) await next.tap()
        else await next.click()
        await menu.locator('.cheat-menu-receipt[data-tone="ok"]', { hasText: 'Next wave spawn queued' }).waitFor()
        await waitUntil(() => wire.snapshot?.world.kind === 'boneyard'
          && wire.snapshot.world.waves?.waveEventId === before.waves.waveEventId + 1,
        'The click did not produce one authoritative wave start', 5000)
        const after = structuredClone(wire.snapshot.world)
        assert.equal(after.waves.waveOrdinal, before.waves.waveOrdinal + 1)
        assert.equal(after.waves.phase, 'spawning')
        assert.ok(after.waves.pendingSpawnBudget > 0)
        if (before.waves.waveOrdinal === 0) assert.equal(after.waves.scheduleIndex, 0)
        else assert.ok(NATIVE_RETAIL_WAVES[before.waves.scheduleIndex].next
          .some(offset => before.waves.scheduleIndex + offset === after.waves.scheduleIndex))
        const survivingIds = new Set(after.enemies.map(enemy => enemy.id))
        assert.ok(before.enemies.every(enemy => survivingIds.has(enemy.id)), 'Advancing deleted an existing enemy')
        await page.waitForFunction(() => [...document.querySelectorAll('.cheat-menu-action')]
          .find(button => button.textContent === 'NEXT WAVE SPAWN')?.disabled === true)
        await next.scrollIntoViewIfNeeded()
        const bounds = await next.boundingBox()
        const viewport = page.viewportSize()
        assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0
          && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height)
        await page.screenshot({ path: `${output}/${touch ? 'touch' : 'desktop'}-wave-${index + 1}.png` })
        starts.push({ before: before.waves, after: after.waves, preservedEnemies: before.enemies.length })
      }
      await waitUntil(() => wire.snapshot.world.waves.pendingSpawnBudget === 0, 'Final authored births did not finish', 60_000)
      await menu.getByRole('button', { name: 'Close cheat menu' }).click()
      await page.keyboard.press('Escape')
      const pause = page.getByRole('dialog', { name: 'Game paused' })
      await pause.waitFor()
      await page.locator('.gameplay-pause-overlay[data-gameplay-pause-reveal="1"]')
        .waitFor()
      await assert.rejects(lua(page, 'return sd.waves.spawn_next()'), /paused/)
      await pause.getByRole('button', { name: 'CHEAT MENU', exact: true }).click()
      await menu.waitFor()
      await menu.getByRole('button', { name: 'Close cheat menu' }).click()
      await page.keyboard.press('Escape')
      await pause.waitFor()
      await page.locator('.gameplay-pause-overlay[data-gameplay-pause-reveal="1"]')
        .waitFor()
      await pause.getByRole('button', { name: 'GAME SETTINGS', exact: true }).click()
      await settings.waitFor()
      await settings.getByRole('button', { name: 'ONLINE AND ACCOUNT', exact: true }).click()
      await cheats.click()
      await settings.getByRole('button', { name: 'BACK', exact: true }).click()
      await settings.getByRole('button', { name: 'DONE', exact: true }).click()
      await page.waitForFunction(() => window.solomonDark === undefined)
      await page.keyboard.press('Backquote')
      assert.equal(await menu.count(), 0)
      assert.deepEqual(wire.errors, [])
      journeys.push({ touch, starts, source: wire.boneyard?.sourceSha256,
        fixture: host ? 'Real built client; exact source host; authentic Solomon release after player positioning; admitted health restoration'
          : 'Live deployed client and host; keyboard navigation; admitted health restoration' })
    } finally {
      await context.close()
      if (host) await host.close()
    }
  }
  assert.ok(Object.values(errors).every(values => values.length === 0), JSON.stringify(errors))
  const result = { status: 'ok', live, browser: browser.version(), errors, journeys }
  await writeFile(`${output}/receipt.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(JSON.stringify({ message: error.message, errors, journeys }))
  throw error
} finally {
  await browser.close()
  if (frontend) await frontend.close()
}

function lua(page, source) {
  return page.evaluate(code => window.solomonDark.lua.execute(code), source)
}

async function walkToSolomon(page, scene, wire) {
  await waitUntil(() => wire.boneyard !== null, 'No authoritative Boneyard definition received', 5000)
  const geometry = wire.boneyard.scene
  const collision = createBoneyardCollisionWorld(geometry)
  const target = geometry.solomonDig.position
  const deadline = Date.now() + 180_000
  await scene.focus()
  while (Date.now() < deadline) {
    const current = await scene.evaluate(node => ({ x: Number(node.dataset.localPlayerX),
      y: Number(node.dataset.localPlayerY), phase: node.dataset.solomonPhase }))
    if (current.phase !== 'digging') return
    const route = findBoneyardEnemyRoute({ start: current, end: target, bounds: geometry.bounds,
      bodyRadius: PLAYER_CHARACTER_RADIUS, clearance: PLAYER_CHARACTER_RADIUS,
      endBodyRadius: 0, world: collision })
    assert.ok(route?.[1], 'No native collision-safe route to Solomon')
    const delta = { x: route[1].x - current.x, y: route[1].y - current.y }
    const scale = Math.max(Math.abs(delta.x), Math.abs(delta.y), 1)
    const keys = []
    if (Math.abs(delta.x) / scale >= 0.25) keys.push(delta.x > 0 ? 'd' : 'a')
    if (Math.abs(delta.y) / scale >= 0.25) keys.push(delta.y > 0 ? 's' : 'w')
    for (const key of keys) await page.keyboard.down(key)
    try { await page.waitForTimeout(Math.min(500, Math.max(100, Math.hypot(delta.x, delta.y) * 5))) }
    finally { for (const key of keys) await page.keyboard.up(key) }
  }
  throw new Error('Keyboard navigation did not reach Solomon')
}
