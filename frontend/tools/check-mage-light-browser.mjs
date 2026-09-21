import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const [output] = process.argv.slice(2)
assert.ok(output, 'usage: node tools/check-mage-light-browser.mjs OUTPUT')
const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, appType: 'custom', logLevel: 'silent',
  plugins: [{ name: 'mage-browser-pixi',
    resolveId(id) { if (id === 'virtual:mage-browser-pixi') return '\0mage-browser-pixi' },
    load(id) { if (id === '\0mage-browser-pixi') return 'export { Application, Container, Texture } from "pixi.js"' },
  }],
  server: { host: '127.0.0.1', port: 0 } })
server.middlewares.use((request, response, next) => {
  if (request.url !== '/__mage_lifetime') return next()
  response.setHeader('Content-Type', 'text/html')
  response.end('<!doctype html><title>Mage lifetime regression</title><link rel="icon" href="data:,"><body></body>')
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
  })
  const page = await browser.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__mage_lifetime`)
  const result = await page.evaluate(async () => {
    const { Application, Container, Texture } = await import('/@id/__x00__mage-browser-pixi')
    const { interpolateBoneyardEnemySamples, copyBoneyardEnemySamples } = await import('/src/game/client/boneyard-enemy-samples.ts')
    const { NativeMageLightningPulseViews } = await import('/src/game/renderer/native-mage-lightning-pulse-view.ts')
    const { BoneyardSceneLights } = await import('/src/game/renderer/boneyard-scene-lights.ts')
    const check = (condition, text) => { if (!condition) throw new Error(text) }
    const empty = { enemies: [], deathEffects: [], enemyEvents: [], enemyWorldFeedback: {},
      enemyProjectileEffects: [], enemyProjectiles: [], mageLightningPulses: [],
      maggots: [], spiderSilks: [], spiderRemains: [], silkFragments: [], webbedPlayers: {} }
    const bounds = { x: 0, y: 0, w: 1000, h: 1000 }
    const boneyard = { runId: 'mage-lifetime-test', scene: { bounds, solomonDig: null } }
    const settings = { complexLighting: true, complexShadows: true, multipleShadows: true }
    const textures = { branches: [Texture.WHITE, Texture.WHITE], circle: Texture.WHITE,
      forks: [Texture.WHITE, Texture.WHITE, Texture.WHITE, Texture.WHITE], ribbon: Texture.WHITE }
    const app = new Application()
    await app.init({ width: 600, height: 300, preference: 'webgl', autoStart: false })
    document.body.append(app.canvas)
    const proofs = []
    try {
      for (const contactKind of ['world', 'target-attached']) {
        const pulse = { id: 1, ownerActorId: 28139, tick: 103, seed: 42,
          source: { x: 100, y: 100 }, midpoint: { x: 250, y: 100 }, endpoint: { x: 400, y: 100 },
          contact: contactKind === 'world' ? { kind: 'world', position: { x: 400, y: 100 } }
            : { kind: 'target-attached', localOffset: { x: -4, y: 6 }, targetPlayerId: 'target' },
          lightRegistration: { managerLane: 'actor', registrationOrdinal: 73 },
          painterRegistrations: Array.from({ length: contactKind === 'world' ? 3 : 2 }, (_, i) => ({
            managerLane: 'actor', registrationOrdinal: 74 + i,
          })),
        }
        const later = { ...empty, enemies: [{ id: pulse.ownerActorId, lightRegistration: pulse.lightRegistration }],
          mageLightningPulses: [pulse] }
        const birth = interpolateBoneyardEnemySamples(empty, later, 0.6, 103)
        check(birth.enemies.length === 0 && birth.mageLightningPulses.length === 1, 'birth fixture lost membership mismatch')
        // A retained pulse with no creator row exercises independent lifetime.
        const orphan = copyBoneyardEnemySamples({ ...empty, mageLightningPulses: [pulse] }, 103)
        for (const [boundary, sample] of [['birth', birth], ['orphan', orphan]]) {
          const worldRoot = new Container(), views = new NativeMageLightningPulseViews(worldRoot, textures)
          app.stage.addChild(worldRoot)
          const lights = new BoneyardSceneLights(boneyard)
          const ages = []
          try {
            for (let age = 0; age <= 5; age++) {
              const tick = pulse.tick + age
              views.update(sample.mageLightningPulses, tick, () => ({ x: 400, y: 100 }))
              const snapshot = { tick, players: {}, materializingPlayerIds: [],
                primarySpells: { projectiles: [], transients: [] }, secondaryAbilities: { actors: [], players: {}, targetEffects: [] },
                world: { ...sample, kind: 'boneyard', runId: boneyard.runId, bossSpells: [],
                  goodies: [], lanternPosition: null, lanternLightRegistration: null },
              }
              const lit = lights.update(snapshot, 'target', tick, settings, null,
                { x: 300, y: 150, zoom: 1 }, { width: 600, height: 300 }, {}, {}, views, () => 1)
              check(age === 0 ? lit.lightMiscTailCandidateCount > 0 : lit.lightMiscTailCandidateCount === 0,
                'path-light birth lifetime changed')
              if (age === 0) check(views.pathLightBatches[0].lightRegistration.registrationOrdinal === 73,
                'creator registration changed')
              app.renderer.render(app.stage)
              ages.push({ age, pathLights: lit.lightMiscTailCandidateCount, roots: worldRoot.children.length })
            }
            check(worldRoot.children.length === 0, 'pulse resources survived retirement')
            proofs.push({ contactKind, boundary, sampledEnemies: sample.enemies.length, ages })
          } finally { views.destroy(); worldRoot.destroy({ children: true }) }
        }
      }
    } finally { app.destroy(true, { children: true }) }
    return { passed: true, proofs }
  })
  assert.deepEqual(errors, [])
  const receipt = { atUtc: new Date().toISOString(), browser: browser.version(), ...result, errors,
    scope: 'Actual interpolation, pulse views, scene lights and WebGL draws in headed Mac Chrome; synthetic boundary fixtures, not a full live encounter.' }
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt))
} finally { await browser?.close(); await server.close() }
