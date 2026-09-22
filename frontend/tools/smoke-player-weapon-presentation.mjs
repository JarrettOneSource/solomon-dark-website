import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const chromePath = process.env.SDR_CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const screenshotPath = process.env.SDR_WEAPON_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-weapon-presentation.png')
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer.address()
assert.ok(address && typeof address !== 'string')
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const page = await browser.newPage({ viewport: { height: 600, width: 900 } })
const pageErrors = []
const consoleErrors = []
const failedResponses = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('response', response => {
  if (response.status() >= 400) failedResponses.push(response.url())
})
await page.route('**/__weapon-proof', route => route.fulfill({
  body: '<!doctype html><html><body></body></html>', contentType: 'text/html',
}))

try {
  await page.goto(`http://127.0.0.1:${address.port}/__weapon-proof`)
  const receipt = await page.evaluate(async () => {
    const [fixture, actors, simulation, snapshots, items, secondary, mods, staffProgram] = await Promise.all([
      import('/tools/player-damage-smoke-fixture.mjs'),
      import('/src/game/renderer/world-player-view.ts'),
      import('/src/game/core-server/game-simulation.ts'),
      import('/src/game/host/game-snapshot.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/core-kernels/native-secondary-abilities.ts'),
      import('/src/game/renderer/mod-presentation-assets.ts'),
      import('/src/assets/game/player-staff-attachment-program.json'),
    ])
    const loaded = await fixture.loadPlayerProofTextures()
    const modTextures = await mods.loadModPresentationTextures([])
    const application = new fixture.Application()
    await application.init({
      autoStart: false, background: 0x202028, height: 600, width: 900,
      preference: 'webgl', resolution: 1,
    })
    document.body.style.margin = '0'
    document.body.append(application.canvas)
    const config = {
      discipline: 'arcane', displayName: 'Wand', element: 'fire',
    }
    const state = simulation.createGameSimulation({ wizard: config })
    const initial = snapshots.createGameSnapshot(state, 'wizard').players.wizard
    const source = {
      ...initial,
      primaryCast: { ...initial.primaryCast, selectedPrimaryId: 16 },
    }
    const wandRecipe = items.DOWSING_EQUIPMENT_RECIPES[13]
    const robeRecipes = [46, 1, 7, null]
    const view = new actors.PlayerWorldView('fire', loaded.textures, modTextures, application.renderer, false)
    application.stage.addChild(view.container)
    const failures = []
    let effectFrames = 0
    let frames = 0
    let damageFrames = 0
    for (let selector = 0; selector < 6; selector += 1) {
      const weapon = {
        ...items.createEquipmentInventoryItem(wandRecipe, 100),
        nativeSelector: selector, recipeIndex: null,
      }
      for (const robeRecipe of robeRecipes) {
        for (let heading = 0; heading < 24; heading += 1) {
          for (let pose = 0; pose < 3; pose += 1) {
            const player = {
              ...source, headingIndex: heading, position: { x: 450, y: 300 },
              economy: { ...source.economy, equipment: {
                ...source.economy.equipment, weapon,
                robe: robeRecipe === null ? null : items.createEquipmentInventoryItem(
                  items.DOWSING_EQUIPMENT_RECIPES[robeRecipe], 101,
                ),
              } },
              progression: { ...source.progression, lastDamageTick: 100 },
            }
            view.setStatusEffects({
              ...secondary.createNativeSecondaryPlayerState(),
              castAction: pose === 0 ? null : { weaponKind: 'wand', progress: pose === 1 ? 0.5 : 1 },
            }, 100)
            view.update(player, 100)
            application.renderer.render(application.stage)
            if (view.robeFixedPose !== pose + 14 || view.attachmentPose !== pose
              || view.fixed.texture !== loaded.textures.equipment.robeFixed.primary[heading][pose + 14]
              || view.staffFront.texture !== loaded.textures.equipment.wand.front[heading][pose]
              || view.staffBack.texture !== loaded.textures.equipment.wand.back[heading][pose]) {
              failures.push({
                selector, robeRecipe, heading, pose,
                actualPose: view.robeFixedPose,
                actualAttachment: view.attachmentPose,
                selectedPrimary: player.primaryCast.selectedPrimaryId,
              })
            }
            if (view.hitFixed.texture === view.fixed.texture
              && view.hitStaffFront.texture === view.staffFront.texture) damageFrames += 1
            if (view.orbSpriteCount > 0 && view.elementEffectScale === Math.fround(0.6)) {
              effectFrames += 1
            }
            frames += 1
          }
        }
      }
    }
    let staffFrames = 0
    view.setStatusEffects(secondary.createNativeSecondaryPlayerState(), 200)
    for (let selector = 0; selector < 6; selector += 1) {
      const weapon = { ...items.createEquipmentInventoryItem(items.DOWSING_EQUIPMENT_RECIPES[18], 199),
        recipeIndex: null, nativeSelector: selector }
      for (let pose = 0; pose < 10; pose += 1) {
        for (let headingIndex = 0; headingIndex < 24; headingIndex += 1) {
          view.update({ ...source, headingIndex,
            economy: { ...source.economy, equipment: { ...source.economy.equipment, weapon } },
          }, 200, pose)
          application.renderer.render(application.stage)
          const [x, y] = staffProgram.default.frames[pose][headingIndex].start
          if (view.orbSpriteCount === 0 || view.elementEffectScale !== 1
            || view.orbFrontBase.container.x !== x || view.orbFrontBase.container.y !== y) {
            failures.push({ selector, pose, headingIndex, family: 'staff' })
          }
          staffFrames += 1
        }
      }
    }
    const programs = [8, 16, 24, 32, 40, ...Array.from({ length: 15 }, (_, i) => 1000 + i)]
    const programReceipts = []
    for (const recipeIndex of [2, 13, 28, 41, 42, 43, 44, 45, 18]) {
      const weapon = items.createEquipmentInventoryItem(items.DOWSING_EQUIPMENT_RECIPES[recipeIndex], 200)
      const kind = weapon.equipmentType
      for (const selectedPrimaryId of programs) {
        for (const phase of [0, Math.fround(0.45)]) {
          view.setStatusEffects(secondary.createNativeSecondaryPlayerState(), 200)
          const player = {
            ...source, headingIndex: 6, position: { x: 450, y: 300 },
            lighting: { ...source.lighting, overlayEffectPhase: phase },
            primaryCast: { ...source.primaryCast, selectedPrimaryId },
            progression: { ...source.progression, damageX4TicksRemaining: 100, hardenCoating: 1 },
            economy: { ...source.economy, equipment: { ...source.economy.equipment, weapon } },
          }
          view.update(player, 200)
          application.renderer.render(application.stage)
          const expectedScale = Math.fround((kind === 'wand' ? Math.fround(0.6) : 1) * (1 + 10 * phase))
          const tip = kind === 'wand' ? { x: 39.5, y: -5 } : { x: 38.5, y: -61.5 }
          if (view.orbSpriteCount === 0 || view.damageX4SpriteCount < 2
            || view.elementEffectScale !== expectedScale
            || view.orbFrontBase.container.x !== tip.x || view.orbFrontBase.container.y !== tip.y
            || view.orbHardenOverlay.container.y !== tip.y
            || view.orbFrontOverlay.container.y !== tip.y + 1
            || view.orbFrontBase.container.zIndex <= view.head.zIndex
            || (phase === 0 && view.orbFrontOverlay.container.zIndex >= view.head.zIndex)
            || (phase > 0 && view.orbFrontOverlay.container.zIndex <= view.head.zIndex)) {
            failures.push({ recipeIndex, selectedPrimaryId, phase, count: view.orbSpriteCount,
              actualScale: view.elementEffectScale, expectedScale, tip })
          }
          programReceipts.push({ recipeIndex, selectedPrimaryId, phase, count: view.orbSpriteCount })
          if (selectedPrimaryId !== 8 || phase !== 0) continue
          view.setStatusEffects({ ...secondary.createNativeSecondaryPlayerState(), stoneskinTicksRemaining: 100 }, 200)
          view.update(player, 200)
          if (view.orbHardenOverlay.container.visible) failures.push({ recipeIndex, lifecycle: 'stoneskin' })
          view.setStatusEffects({ ...secondary.createNativeSecondaryPlayerState(), planewalkerTicksRemaining: 100 }, 200)
          view.update(player, 200)
          if (view.orbSpriteCount !== 0) failures.push({ recipeIndex, lifecycle: 'planewalker' })
          view.setStatusEffects(secondary.createNativeSecondaryPlayerState(), 200)
          view.update(player, 200)
          if (view.orbSpriteCount === 0) failures.push({ recipeIndex, lifecycle: 'restore' })
          for (const suppressed of [
            { ...player, primaryCast: { ...player.primaryCast, selectedPrimaryId: -1 } },
            { ...player, economy: { ...player.economy, equipment: { ...player.economy.equipment, weapon: null } } },
            { ...player, progression: { ...player.progression, lifeState: 'dying', deathTick: 153 } },
          ]) {
            view.update(suppressed, 200)
            if (view.orbSpriteCount !== 0 || view.damageX4SpriteCount !== 0) failures.push({ recipeIndex, lifecycle: 'suppressed' })
          }
          view.update(player, 200, null, false)
          if (view.orbSpriteCount !== 0) failures.push({ recipeIndex, lifecycle: 'scene-suppressed' })
        }
      }
    }
    view.destroy()
    if (!view.container.destroyed) failures.push({ lifecycle: 'destroy' })
    const previews = []
    for (let heading = 0; heading < 24; heading += 4) {
      for (let pose = 0; pose < 3; pose += 1) {
        const sample = new actors.PlayerWorldView('fire', loaded.textures, modTextures, application.renderer, false)
        sample.setStatusEffects({
          ...secondary.createNativeSecondaryPlayerState(),
          castAction: pose === 0 ? null : { weaponKind: 'wand', progress: pose === 1 ? 0.5 : 1 },
        }, 200)
        sample.update({
          ...source, headingIndex: heading,
          position: { x: 80 + heading / 4 * 145, y: 135 + pose * 170 },
          economy: { ...source.economy, equipment: {
            ...source.economy.equipment, weapon: items.createEquipmentInventoryItem(wandRecipe, 100),
          } },
        }, 200)
        application.stage.addChild(sample.container)
        previews.push(sample)
      }
    }
    application.renderer.render(application.stage)
    window.__weaponProofCleanup = () => {
      for (const preview of previews) preview.destroy()
      application.destroy({ removeView: true })
      modTextures.destroy()
      loaded.destroy()
    }
    return { frames, staffFrames, damageFrames, effectFrames, programCases: programReceipts.length, failures }
  })
  assert.equal(receipt.frames, 1728)
  assert.equal(receipt.staffFrames, 1440)
  assert.equal(receipt.programCases, 360)
  assert.equal(receipt.damageFrames, receipt.frames)
  assert.equal(receipt.effectFrames, receipt.frames, 'every Wand pose must render its selected-element effect at native scale')
  assert.equal(receipt.failures.length, 0, JSON.stringify(receipt.failures.slice(0, 5)))
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  await page.screenshot({ path: screenshotPath })
  console.log(JSON.stringify({ ...receipt, pageErrors, consoleErrors, failedResponses, screenshotPath }))
  await page.evaluate(() => window.__weaponProofCleanup())
} finally {
  await browser.close()
  await vite.close()
}
