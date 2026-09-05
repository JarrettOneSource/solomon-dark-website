import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', root, server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer.address()
assert.ok(address && typeof address !== 'string')
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { console: [], page: [], responses: [] }
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) errors.responses.push(response.url())
  })
  await page.route('**/__hat-proof', route => route.fulfill({
    body: '<!doctype html><html><body style="margin:0"></body></html>',
    contentType: 'text/html',
  }))
  await page.goto(`http://127.0.0.1:${address.port}/__hat-proof`)
  const receipt = await page.evaluate(async () => {
    const [fixture, actors, simulation, snapshots, items, mods] = await Promise.all([
      import('/tools/player-damage-smoke-fixture.mjs'),
      import('/src/game/renderer/hub-actors.ts'),
      import('/src/game/core-server/game-simulation.ts'),
      import('/src/game/host/game-snapshot.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/renderer/mod-presentation-assets.ts'),
    ])
    const loaded = await fixture.loadPlayerProofTextures()
    const modTextures = await mods.loadModPresentationTextures([])
    const application = new fixture.Application()
    await application.init({
      autoStart: false, background: 0x303038, height: 640, width: 960,
      preference: 'webgl', resolution: 1,
    })
    document.body.append(application.canvas)
    const target = fixture.RenderTexture.create({ width: 320, height: 240 })
    const config = { discipline: 'arcane', displayName: 'Hood', element: 'earth' }
    const state = simulation.createGameSimulation({ wizard: config })
    const initial = snapshots.createGameSnapshot(state, 'wizard').players.wizard
    const view = new actors.PlayerWorldView('earth', loaded.textures, modTextures, application.renderer, false)
    application.stage.addChild(view.container)
    const failures = []
    const readPixels = () => {
      application.renderer.render({ container: application.stage, target, clear: true })
      return application.renderer.extract.pixels({ target }).pixels
    }
    const player = (selector, heading, gait, damageTick, color) => ({
      ...initial, headingIndex: heading, gaitDegrees: gait,
      position: { x: 160, y: 150 },
      primaryCast: { ...initial.primaryCast, selectedPrimaryId: 16 },
      progression: { ...initial.progression, lastDamageTick: damageTick },
      economy: { ...initial.economy, equipment: { ...initial.economy.equipment,
        hat: { ...items.createEquipmentInventoryItem(items.DOWSING_EQUIPMENT_RECIPES[16], 100),
          nativeSelector: selector, recipeIndex: null, iconTints: [color, 0xffffff] },
      } },
    })
    let frames = 0
    for (let selector = 0; selector < 4; selector += 1) {
      for (let heading = 0; heading < 24; heading += 1) {
        for (const [gait, damageTick, color] of [[0, -1000, 0x99cc99], [90, 200, 0xaaccff]]) {
          view.update(player(selector, heading, gait, damageTick, color), 200)
          const actual = readPixels()
          // Ordinary death and living Hat draws consume the same native banks.
          // The independently extracted death layers retain the native mapping.
          view.head.texture = loaded.textures.death.hat.primary[selector][heading]
          view.headSecondary.texture = loaded.textures.death.hat.secondary[selector][heading]
          view.hitHead.texture = view.head.texture
          view.hitHeadSecondary.texture = view.headSecondary.texture
          const expected = readPixels()
          let differentPixels = 0
          for (let offset = 0; offset < actual.length; offset += 4) {
            if (actual.slice(offset, offset + 4).some((value, channel) => value !== expected[offset + channel])) {
              differentPixels += 1
            }
          }
          if (differentPixels) failures.push({ selector, heading, gait, differentPixels })
          frames += 1
        }
      }
    }
    view.destroy()
    target.destroy(true)
    const previews = []
    const headings = [0, 3, 6, 9, 12, 18]
    for (let selector = 0; selector < 4; selector += 1) {
      for (const [column, heading] of headings.entries()) {
        const preview = new actors.PlayerWorldView('earth', loaded.textures, modTextures, application.renderer, false)
        preview.update({ ...player(selector, heading, 0, -1000, 0x99cc99),
          position: { x: 80 + column * 160, y: 140 + selector * 160 } }, 200)
        preview.container.scale.set(1.5)
        application.stage.addChild(preview.container)
        previews.push(preview)
      }
    }
    application.renderer.render(application.stage)
    window.__hatProofCleanup = () => {
      for (const preview of previews) preview.destroy()
      application.destroy({ removeView: true })
      modTextures.destroy()
      loaded.destroy()
    }
    return { frames, failures }
  })
  const screenshotPath = process.env.SDR_HAT_SCREENSHOT || join(tmpdir(), 'solomon-dark-hat-presentation.png')
  await page.screenshot({ path: screenshotPath })
  await page.evaluate(() => window.__hatProofCleanup())
  console.log(JSON.stringify({ ...receipt, errors, screenshotPath }))
  assert.equal(receipt.frames, 192)
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  assert.deepEqual(receipt.failures, [], 'Every rendered Hat must match the native primary/secondary layers')
} finally {
  await browser.close()
  await vite.close()
}
