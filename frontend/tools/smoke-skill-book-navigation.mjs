import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { grantPlayerEntitySkillRanks, grantPlayerEntityWeldBuild } from '../src/game/core-server/player-entity-store.ts'
import { nativeSkillBookPageLayout, nativeSkillBookPages, nativeSkillBookTooltipLines } from '../src/game/skill-book-model.ts'
import { nativeSkillHoverBoxLayout } from '../src/game/renderer/native-skill-hover-box-layout.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_SKILL_BOOK_NAVIGATION_OUTPUT
assert.ok(output, 'Set a task-owned evidence directory')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { page: [], console: [], responses: [], requests: [], host: [] }
const receipts = []
let host
try {
  for (const scenario of [
    { name: 'desktop', width: 1600, height: 900, touch: false },
    { name: 'touch', width: 844, height: 390, touch: true },
  ]) {
    for (const branch of process.argv.includes('--quick') ? ['a'] : ['a', 'b']) {
      const credential = randomBytes(32).toString('base64url')
      host = await startGameHost({
        allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
        sessionKind: 'standalone', snapshotRate: 20,
        createBoneyardSeedBytes: () => Buffer.alloc(16),
        log: event => { if (event.level === 'error') errors.host.push(event) },
      })
      const context = await browser.newContext({
        viewport: { width: scenario.width, height: scenario.height },
        hasTouch: scenario.touch, isMobile: scenario.touch,
      })
      const page = await context.newPage()
      page.on('pageerror', error => errors.page.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
      page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
      page.on('requestfailed', request => {
        const message = request.failure()?.errorText
        if (message === 'net::ERR_ABORTED' && (/\.(?:mp3|ogg|wav)(?:\?|$)/.test(request.url())
          || new URL(request.url()).pathname === '/deployment.json')) return
        errors.requests.push(`${request.url()}: ${message}`)
      })
      await page.addInitScript(({ runtime, settingsKey, settings }) => {
        window.solomonDarkRuntime = runtime
        localStorage.setItem(settingsKey, JSON.stringify(settings))
      }, {
        runtime: { gameEndpoint: { credential, kind: 'localhost', url: host.address.url } },
        settingsKey: GAME_SETTINGS_STORAGE_KEY,
        settings: { ...DEFAULT_GAME_SETTINGS, controls: {
          ...DEFAULT_GAME_SETTINGS.controls, openInventory: 'KeyB', openSkills: 'KeyV',
        } },
      })
      await page.route('**/deployment.json*', route => route.fulfill({
        json: { revision: new URL(route.request().url()).searchParams.get('current') },
      }))
      await enterElementHub(page, server.origin, 'Fire')
      for (const scene of ['hub', 'boneyard']) {
        if (scene === 'boneyard') await enterBoneyard(page)
        await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 20000 })
        const playerId = host.hostPlayerId()
        const fixture = grantFixture(playerId, branch)
        await page.getByRole('button', { name: 'Open skills', exact: true }).click()
        const stage = page.locator('.skill-book-stage[data-transition-phase="settled"][data-renderer-state="ready"]')
        await stage.waitFor({ timeout: 90000 })
        await page.waitForFunction(expected => {
          const ids = new Set([...document.querySelectorAll('.skill-book-entry-action')].map(node => Number(node.dataset.skillId)))
          return ids.size === expected.length && expected.every(id => ids.has(id))
        }, fixture.ids)
        const entryCount = await stage.locator('.skill-book-entry-action').count()
        assert.equal(entryCount, fixture.layout.placements.reduce((n, p) => n + p.page.rows.length, 0))
        assert.equal(fixture.layout.rowCount, 2)
        const maximum = fixture.layout.contentWidth - 1600
        assert.ok(maximum > 0)
        assert.equal(Number(await stage.getAttribute('data-skill-book-scroll-x')), 0)
        assert.equal(Number(await stage.getAttribute('data-skill-book-scroll-max')), maximum)
        const name = `${scenario.name}-${branch}-${scene}`
        await page.screenshot({ path: `${output}/${name}-start.png` })
        const viewport = stage.locator('.skill-book-viewport')
        const beforeHud = await stage.locator('[data-skill-book-resume]').boundingBox()
        await backgroundDrag(page, stage, scenario.touch)
        const dragged = Number(await stage.getAttribute('data-skill-book-scroll-x'))
        assert.ok(dragged > 0 && dragged <= maximum)
        assert.deepEqual(await stage.locator('[data-skill-book-resume]').boundingBox(), beforeHud)
        await stage.focus()
        await page.keyboard.press('End')
        await waitForOffset(stage, maximum)
        await page.keyboard.press('ArrowLeft')
        await waitForOffset(stage, maximum - 25)
        await page.keyboard.press('Home')
        await waitForOffset(stage, 0)

        // Traverse actual semantic controls. Focus must reveal each complete
        // native column and drive the real renderer's detail owner.
        const visited = new Set()
        for (let index = 0; index < entryCount; index += 1) {
          const entry = stage.locator('.skill-book-entry-action').nth(index)
          const id = Number(await entry.getAttribute('data-skill-id'))
          await entry.focus()
          await page.waitForFunction(element => {
            const viewport = document.querySelector('.skill-book-viewport').getBoundingClientRect()
            const bounds = element.getBoundingClientRect()
            return bounds.left >= viewport.left - 0.5 && bounds.right <= viewport.right + 0.5
              && bounds.top >= viewport.top && bounds.bottom <= viewport.bottom
          }, await entry.elementHandle())
          const rootId = Number(await entry.evaluate(node => node.closest('[data-root-skill-id]').dataset.rootSkillId))
          await page.waitForFunction(({ id, rootId }) => {
            const data = document.querySelector('.skill-book-canvas')?.dataset
            return data?.nativeHoverSkillId === `${id}` && data.nativeHoverRootSkillId === `${rootId}`
          }, { id, rootId })
          const row = fixture.layout.placements.find(p => p.page.rootSkillId === rootId).page.rows.find(row => row.id === id)
          const source = await entry.evaluate(node => {
            const icon = node.getBoundingClientRect()
            const stage = node.closest('.skill-book-stage').getBoundingClientRect()
            return { x: (icon.left + icon.width / 2 - stage.left) * 1600 / stage.width,
              y: (icon.top + icon.height / 2 - stage.top) * 900 / stage.height }
          })
          const box = nativeSkillHoverBoxLayout(nativeSkillBookTooltipLines(row), source.x, source.y)
          const pixels = await page.evaluate(bounds => new Promise(resolve => requestAnimationFrame(() => {
            const canvas = document.querySelector('.skill-book-canvas')
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
            const samples = []
            for (const x of [bounds.x + 10, bounds.x + bounds.width - 10]) {
              const rgba = new Uint8Array(4)
              gl.readPixels(Math.floor(x * gl.drawingBufferWidth / 1600),
                gl.drawingBufferHeight - 1 - Math.floor((bounds.y + bounds.height / 2) * gl.drawingBufferHeight / 900),
                1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
              samples.push([...rgba])
            }
            resolve(samples)
          })), { x: box.x, y: box.y, width: box.width, height: box.height })
          assert.ok(pixels.every(([r, g, b, a]) => r <= 1 && g <= 1 && b <= 1 && a >= 250),
            `${name} skill${id}/page${rootId}: expected native detail box at the visible icon`)
          visited.add(id)
        }
        assert.deepEqual([...visited].sort((a, b) => a - b), [...fixture.ids].sort((a, b) => a - b))
        await page.screenshot({ path: `${output}/${name}-last.png` })

        const primary = stage.locator('.skill-book-entry-action[data-skill-id="8"]').first()
        assert.notEqual(progression(playerId).selectedPrimarySkillId, 8)
        await primary.focus()
        if (scenario.touch) await primary.tap(); else await primary.click()
        await waitUntil(() => progression(playerId).selectedPrimarySkillId === 8, 'Visible primary selection was not accepted', 5000)
        const unselectedConcentration = fixture.layout.placements.flatMap(p => p.page.rows)
          .find(row => row.category === 3 && !progression(playerId).concentrationSkillIds.includes(row.id))
        assert.ok(unselectedConcentration, 'Fixture has an unselected learned concentration')
        const concentrationId = unselectedConcentration.id
        const concentration = stage.locator(`.skill-book-entry-action[data-skill-id="${concentrationId}"]`).first()
        await concentration.focus()
        if (scenario.touch) await concentration.tap(); else await concentration.click()
        await waitUntil(() => progression(playerId).concentrationSkillIds.includes(concentrationId), 'Visible concentration selection was not accepted', 5000)

        // Preserve duplicate-capable belt assignment through scrolled pages.
        const secondary = stage.locator('.skill-book-entry-action[data-skill-id="21"]').first()
        await secondary.focus()
        const beforeBelt = createGameSnapshot(host.state(), playerId).players[playerId].belt
        assert.ok(beforeBelt.some(entry => entry?.skillId === 21), 'Fixture retains the native starter binding')
        const destinationSlot = beforeBelt.findLastIndex(entry => entry?.skillId !== 21)
        assert.notEqual(destinationSlot, -1)
        const source = await secondary.boundingBox()
        const destination = await stage.locator('.skill-book-quickbar-action').nth(destinationSlot).boundingBox()
        await gesture(page, { x: source.x + source.width / 2, y: source.y + source.height / 2 },
          { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 }, scenario.touch)
        await waitUntil(() => createGameSnapshot(host.state(), playerId).players[playerId].belt[destinationSlot]?.skillId === 21,
          'Scrolled belt drag was not accepted', 5000)
        assert.ok(createGameSnapshot(host.state(), playerId).players[playerId].belt.filter(entry => entry?.skillId === 21).length >= 2)
        await stage.focus()
        await page.keyboard.press('End')
        await waitForOffset(stage, maximum)
        await page.keyboard.press('b')
        await page.getByRole('dialog', { name: 'Inventory', exact: true }).waitFor({ timeout: 20000 })
        await page.keyboard.press('v')
        await stage.waitFor({ timeout: 20000 })
        await waitForOffset(stage, 0)
        assert.equal(progression(playerId).selectedPrimarySkillId, 8)
        await stage.locator('[data-skill-book-resume]').click()
        await stage.waitFor({ state: 'detached', timeout: 20000 })
        receipts.push({ name, fixture: 'valid grant/Weld API; legal alternate mutually-exclusive branches; not reporter-save replay',
          ownedIds: fixture.ids, semanticEntries: entryCount, contentWidth: fixture.layout.contentWidth,
          viewportRows: 2, maximum, dragged, everyEntryFocused: true, primary: 8, concentration: concentrationId,
          duplicateBeltSlot: destinationSlot,
          duplicateDependencySources: fixture.layout.placements.filter(p => p.page.rows.some(row => row.id === 22)).length,
          reciprocalInventory: true, reopenedOffset: 0 })
      }
      await context.close()
      await host.close()
      host = null
    }
  }
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], host: [] })
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'ok', productionClient: true, receipts, errors }, null, 2))
  console.log(JSON.stringify({ status: 'ok', productionClient: true, receipts, errors }))
} finally {
  await browser.close()
  await host?.close()
  await server.close()
}

function progression(playerId) {
  return createGameSnapshot(host.state(), playerId).players[playerId].progression
}

function grantFixture(playerId, branch) {
  const excluded = new Set(branch === 'a' ? [13, 19, 29, 36, 47] : [14, 20, 31, 37, 44])
  for (let id = 8; id < 80; id += 1) {
    if (id === 52 || excluded.has(id)) continue
    const state = host.state()
    const next = grantPlayerEntitySkillRanks(state.playerEntities, playerId, id, 1, state.gameRng)
    Object.assign(state, { playerEntities: next.store, gameRng: next.rng })
  }
  const state = host.state()
  const weld = grantPlayerEntityWeldBuild(state.playerEntities, playerId, 1000, state.gameRng)
  Object.assign(state, { playerEntities: weld.store, gameRng: weld.rng })
  const pages = nativeSkillBookPages(progression(playerId))
  return { ids: [...new Set(pages.flatMap(page => page.rows.map(row => row.id)))], layout: nativeSkillBookPageLayout(pages) }
}

async function waitForOffset(stage, offset) {
  await stage.page().waitForFunction(({ offset }) => {
    return Number(document.querySelector('.skill-book-stage')?.dataset.skillBookScrollX) === offset
  }, { offset })
}

async function backgroundDrag(page, stage, touch) {
  const bounds = await stage.boundingBox()
  const point = (x, y) => ({ x: bounds.x + x * bounds.width / 1600, y: bounds.y + y * bounds.height / 900 })
  const start = point(1200, 740)
  const end = point(400, 740)
  await gesture(page, start, end, touch)
}

async function gesture(page, start, end, touch) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 2 })
    await page.mouse.up()
  }
}
