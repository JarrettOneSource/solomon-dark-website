import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'

const [output, scope = 'all'] = process.argv.slice(2)
assert.ok(output, 'usage: node --experimental-strip-types tools/check-player-material-capture-browser.mjs OUTPUT [all|enchant]')
assert.ok(['all', 'enchant'].includes(scope), 'unknown player material probe scope')
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, appType: 'custom', logLevel: 'error',
  plugins: [{ name: 'player-material-browser-pixi',
    resolveId(id) { if (id === 'virtual:player-material-browser-pixi') return '\0player-material-browser-pixi' },
    load(id) {
      if (id === '\0player-material-browser-pixi') return 'export { Container, Matrix, Mesh, MeshSimple, Sprite, RenderTexture, Texture } from "pixi.js"'
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
})
server.middlewares.use((request, response, next) => {
  if (request.url !== '/__player_material_capture') return next()
  response.setHeader('Content-Type', 'text/html')
  response.end('<!doctype html><title>Player material capture regression</title><link rel="icon" href="data:,"><body></body>')
})
const players = ['air', 'earth', 'ether', 'fire', 'water'].map(element => (
  createGameSnapshot(createGameSimulation({ player: {
    discipline: 'mind', displayName: `Material ${element}`, element,
  } }), 'player').players.player
))
for (const player of players) {
  player.primaryCast.selectedPrimaryId = { air: 24, earth: 40, ether: 8, fire: 16, water: 32 }[player.config.element]
  player.progression.selectedPrimarySkillId = player.primaryCast.selectedPrimaryId
  player.progression.damageX4TicksRemaining = 100
  player.position = { x: 192, y: 224 }
}
for (let program = 1000; program <= 1009; program++) {
  const player = structuredClone(players[2])
  player.primaryCast.selectedPrimaryId = program
  player.progression.selectedPrimarySkillId = program
  player.progression.weldBuildId = program
  players.push(player)
}
for (const source of [...players]) {
  const wand = structuredClone(source)
  Object.assign(wand.economy.equipment.weapon, { equipmentType: 'wand', nativeTypeId: 7011, nativeSelector: 0 })
  players.push(wand)
}
const fixtures = players.map(player => ({ player, headings: [0, 6, 12, 18], name: 'equipped idle' }))
for (const source of players.filter(player => player.economy.equipment.weapon.equipmentType === 'staff')) {
  const player = structuredClone(source)
  player.economy.equipment.weapon = null
  fixtures.push({ player, headings: player.primaryCast.selectedPrimaryId === 16
    ? Array.from({ length: 24 }, (_, index) => index) : [0, 6, 12, 18], name: 'bare idle' })
}
for (const pose of [1, 2, 3]) {
  const player = structuredClone(players[3])
  player.economy.equipment.weapon = null
  player.primaryCast.handCast1 = { firstPose: pose === 3 ? 3 : 0, progress: pose === 3 ? .2 : pose + .2,
    pose, rate: Math.fround(Math.fround(.095) * .75), done: false }
  player.primaryCast.actionTick = 1
  fixtures.push({ player, headings: Array.from({ length: 24 }, (_, index) => index), name: `bare Cast 1 pose ${pose}` })
}
const channelPlayer = structuredClone(players[0])
channelPlayer.economy.equipment.weapon = null
Object.assign(channelPlayer.primaryCast, { channelActive: true, actionTick: 1 })
fixtures.push({ player: channelPlayer, headings: Array.from({ length: 24 }, (_, index) => index), name: 'bare Constant' })
for (const action of [
  { name: 'bare Cast 2 admission', castAction: { weaponKind: null, progress: 0, handPose: 0, handDone: false } },
  { name: 'bare Cast 2 terminal', castAction: { weaponKind: null, progress: 6, handPose: 3, handDone: true } },
  { name: 'bare Spin', spin: true },
]) {
  const player = structuredClone(players[3])
  player.economy.equipment.weapon = null
  fixtures.push({ player, headings: [0, 6, 12, 18], ...action })
}
const handProgram = JSON.parse(await readFile(new URL('../src/assets/game/player-bare-hand-program.json', import.meta.url), 'utf8'))
let browser
const errors = { page: [], console: [], network: [] }
try {
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 700, height: 650 } })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('requestfailed', request => errors.network.push(`${request.url()}: ${request.failure()?.errorText}`))
  page.on('response', response => { if (response.status() >= 400) errors.network.push(`${response.status()} ${response.url()}`) })
  await page.goto(`http://127.0.0.1:${address.port}/__player_material_capture`)
  const result = await page.evaluate(async ({ fixtures, handProgram }) => {
    const { Container, Matrix, Mesh, MeshSimple, Sprite, RenderTexture } = await import('/@id/__x00__player-material-browser-pixi')
    const { createGameWebGlApplication } = await import('/src/game/renderer/game-webgl.ts')
    const { loadBoneyardWorldTextures, destroyBoneyardWorldTextures } = await import('/src/game/renderer/boneyard-textures.ts')
    const { loadModPresentationTextures } = await import('/src/game/renderer/mod-presentation-assets.ts')
    const { PlayerWorldView } = await import('/src/game/renderer/world-player-view.ts')
    const { nativeSecondarySpriteRecord, nativeSecondarySpriteKey } = await import('/src/game/renderer/native-secondary-assets.ts')
    const { nativePlayerMagicShieldPlan } = await import('/src/game/renderer/native-secondary-field-presentation.ts')
    const { createNativeSecondaryPlayerState } = await import('/src/game/core-kernels/native-secondary-abilities.ts')
    const { createNativeRng } = await import('/src/game/core-kernels/native-rng.ts')
    const { createNativeStoneskinWarp } = await import('/src/game/core-kernels/native-stoneskin.ts')
    const { NativeElementVfxView } = await import('/src/game/renderer/native-element-vfx-view.ts')
    const { PlayerDamageX4VfxView } = await import('/src/game/renderer/player-damage-x4-vfx-view.ts')
    const { playerStaffAttachmentOffset, playerWandSpellEmitterOffset } = await import('/src/game/core-kernels/native-player-weapon.ts')
    const { PlayerEnchantStaffView } = await import('/src/game/renderer/player-enchant-staff-view.ts')
    const { nativeEnchantStaffDrawPlan } = await import('/src/game/player-enchant-staff-presentation.ts')
    const { playerCharacterStaffIsFront } = await import('/src/game/player-character-presentation.ts')
    const { nativePackedColor, setNativeVertexColors } = await import('/src/game/renderer/native-material-batch.ts')
    const { renderNativeDiffuseMask, setNativeDiffuseColor } = await import('/src/game/renderer/native-texture-color.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const { application: app } = await createGameWebGlApplication({ width: 512, height: 512, className: 'material-regression' })
    document.body.append(app.canvas)
    const shieldRecord = nativeSecondarySpriteRecord('Clothes', 2)
    const textures = await loadBoneyardWorldTextures()
    const mods = await loadModPresentationTextures([])
    const warp = createNativeStoneskinWarp(createNativeRng(331)).positions
    const world = new Container()
    const targets = Array.from({ length: 3 }, () => RenderTexture.create({ width: 512, height: 512 }))
    const [baseline, actual, expected] = targets
    const shield = new Sprite(textures.secondary[nativeSecondarySpriteKey('Clothes', 2)])
    shield.anchor.set(shieldRecord.anchorX / shieldRecord.width, shieldRecord.anchorY / shieldRecord.height)
    shield.blendMode = 'add'
    const orb = new NativeElementVfxView(null, textures.elementVfx)
    const damage = new PlayerDamageX4VfxView(textures.secondary[nativeSecondarySpriteKey('BadGuys', 7)])
    const independentPlayer = new Container()
    independentPlayer.addChild(damage.container, orb.container, shield)
    damage.container.zIndex = 9
    orb.container.zIndex = 9
    shield.zIndex = 10
    const ordinaryHelpers = Array.from({ length: 3 }, () => {
      const container = new Container()
      const element = new NativeElementVfxView(null, textures.elementVfx)
      const damage = new PlayerDamageX4VfxView(textures.secondary[nativeSecondarySpriteKey('BadGuys', 7)])
      container.addChild(damage.container, element.container)
      return { container, element, damage }
    })
    const render = (container, target) => app.renderer.render({ container, target, clear: true, clearColor: [0.05, 0.05, 0.05, 1] })
    const pixels = target => app.renderer.extract.pixels({ target }).pixels
    const comparePixels = (first, second) => {
      let count = 0, maximumChannelDifference = 0
      for (let index = 0; index < first.length; index += 4) {
        for (let channel = 0; channel < 4; channel++) {
          maximumChannelDifference = Math.max(maximumChannelDifference, Math.abs(first[index + channel] - second[index + channel]))
        }
        if (first[index] !== second[index] || first[index + 1] !== second[index + 1]
          || first[index + 2] !== second[index + 2] || first[index + 3] !== second[index + 3]) count++
      }
      return { changedPixels: count, maximumChannelDifference }
    }
    const differences = (first, second) => comparePixels(first, second).changedPixels
    const capture = (view, label) => {
      const material = view.container.getChildByLabel(label)
      check(material?.visible, `${label} is not active`)
      const composite = material.children.find(child => child instanceof Mesh || child instanceof Sprite && child.texture instanceof RenderTexture)
      check(composite?.texture instanceof RenderTexture, `${label} has no captured texture`)
      return composite.texture
    }
    const cases = [], controls = [], ordinary = [], enchant = [], images = []
    try {
      for (const fixture of fixtures) for (const arena of [false, true]) {
        const player = structuredClone(fixture.player)
        player.position = { x: 192, y: 224 }
        player.progression.damageX4TicksRemaining = 100
        const view = new PlayerWorldView(player.config.element, textures, mods, app.renderer, arena)
        world.addChild(view.container)
        const update = (secondary, enhanced, web, elementEffectVisible = true) => {
          view.setStatusEffects({ ...secondary,
            castAction: fixture.castAction ?? secondary.castAction,
            castSpinTicksRemaining: fixture.spin ? 10 : secondary.castSpinTicksRemaining,
          }, 4, web, enhanced, warp)
          view.update(player, 4, null, elementEffectVisible)
          view.setWorldTint(0xbfcfdf)
        }
        try {
          for (const enhanced of [false, true]) for (const heading of fixture.headings) {
            player.headingIndex = heading
            player.headingDegrees = heading * 15
            player.gaitDegrees = 120
            player.lighting.overlayEffectPhase = heading === 0 || heading === 12 ? 0.45 : 0
            const weapon = player.economy.equipment.weapon?.equipmentType ?? null
            const handPose = fixture.castAction?.handPose ?? (fixture.spin ? 3
              : player.primaryCast.handCast1?.pose ?? (player.primaryCast.channelActive ? 2 : 0))
            const hand = handProgram.poses[handPose][heading]
            const bob = Math.fround(Math.sin(Math.fround(Math.fround(8) * 3.141592502593994 / 180)))
            const socket = weapon === null ? { x: hand[0], y: Math.fround(hand[1] + bob) } : weapon === 'wand'
              ? playerWandSpellEmitterOffset(heading, 0) : playerStaffAttachmentOffset(heading, 0)
            // Native 0053B1D0 uses one equipment socket with no body bob.
            const effectScale = Math.fround((weapon === null ? Math.fround(.8) : weapon === 'wand' ? Math.fround(0.6) : 1)
              * (1 + 10 * player.lighting.overlayEffectPhase))
            const admitted = weapon !== null || hand[2] <= handProgram.referenceDepth
              && (handPose !== 2 || player.primaryCast.channelActive)
            for (const effect of [damage, orb]) {
              effect.container.position.set(socket.x, socket.y)
              effect.container.visible = admitted
            }
            orb.updateSelectedPrimary(player.primaryCast.selectedPrimaryId, 4, effectScale)
            damage.update(100, 4, effectScale)
            const zoom = heading === 6 ? 0.75 : heading === 18 ? 1.25 : 1
            world.scale.set(zoom)
            // Independent main-function call matrix: its angle query and raw
            // front argument are separate from the helper's authored socket.
            const query = weapon === null ? handProgram.poses[0][heading] : [socket.x, socket.y]
            const angleY = weapon === 'staff' ? query[1] : query[0]
            let angle = Math.fround(Math.fround(Math.atan2(query[0], -(angleY + (weapon === null ? 10 : 20))))
              * 180 / 3.141592502593994)
            if (angle < 0) angle = Math.fround(angle + 360)
            angle = Math.trunc(angle)
            const backAngle = angle <= 90 || angle > 270
            const backAdmission = weapon !== null || hand[2] >= handProgram.referenceDepth
              && (handPose !== 2 || player.primaryCast.channelActive)
            const highPhase = player.lighting.overlayEffectPhase > Math.fround(.1)
            const calls = [
              { visible: weapon === null && backAngle && admitted, z: .5, translated: false },
              { visible: angle >= 90 && angle <= 270 && backAdmission, z: 8.5, translated: false },
              { visible: (highPhase || backAngle) && backAdmission, z: highPhase ? 8.75 : 1.5, translated: true },
            ]
            const ordinaryState = createNativeSecondaryPlayerState()
            update(ordinaryState, enhanced)
            render(world, actual)
            update(ordinaryState, enhanced, undefined, false)
            for (let index = 0; index < ordinaryHelpers.length; index++) {
              const helper = ordinaryHelpers[index], call = calls[index]
              helper.container.visible = call.visible
              helper.container.zIndex = call.z
              helper.container.position.set(socket.x + (call.translated ? Math.abs(Math.sin(Math.PI / 3)) : 0),
                socket.y + (call.translated ? 1 : 0))
              helper.element.updateSelectedPrimary(player.primaryCast.selectedPrimaryId, 4, effectScale)
              helper.damage.update(100, 4, effectScale)
              view.container.addChild(helper.container)
            }
            render(world, expected)
            for (const helper of ordinaryHelpers) view.container.removeChild(helper.container)
            const ordinaryComparison = comparePixels(pixels(actual), pixels(expected))
            ordinary.push({ fixture: fixture.name, weapon, handPose, heading, arena, enhanced, angle,
              calls, changedPixels: ordinaryComparison.changedPixels,
              maximumChannelDifference: ordinaryComparison.maximumChannelDifference })
            const secondary = { ...createNativeSecondaryPlayerState(), stoneskinTicksRemaining: 100 }
            update(secondary, enhanced, undefined, false)
            const withoutEffects = pixels(capture(view, 'player-stoneskin')).slice()
            update(secondary, enhanced)
            const stoneTarget = capture(view, 'player-stoneskin')
            const unshieldedCapture = pixels(stoneTarget).slice()
            const effectCaptureChanges = differences(withoutEffects, unshieldedCapture)
            const visibleEffects = ['native-element-vfx-back-base', 'player-damage-x4-vfx-back-base',
              'native-element-vfx-front-base', 'native-element-vfx-front-overlay',
              'player-damage-x4-vfx-front-base', 'player-damage-x4-vfx-front-overlay',
              'native-element-vfx-harden-overlay', 'player-damage-x4-vfx-harden-overlay']
              .filter(label => view.container.getChildByLabel(label)?.visible)
            check(unshieldedCapture.some((value, index) => index % 4 === 3 && value > 0), 'the authored wizard capture is empty')
            render(world, baseline)
            if (player.config.element === 'earth' && arena && heading === 6) {
              images.push({ name: `stone-${weapon}-${enhanced ? 'on' : 'off'}-without-shield`, data: await app.renderer.extract.base64({ target: baseline }) })
            }
            for (const pulse of [0, 20, 40]) {
              const protectedState = { ...secondary, magicShieldAbsorb: 25, magicShieldMaximum: 25, magicShieldPulseTicks: pulse }
              update(protectedState, enhanced)
              const captureChanges = differences(unshieldedCapture, pixels(capture(view, 'player-stoneskin')))
              render(world, actual)
              const plan = nativePlayerMagicShieldPlan(protectedState, 4)
              update(secondary, enhanced, undefined, false)
              shield.position.set(0, -35)
              shield.scale.set(plan.scale)
              shield.alpha = plan.alpha
              independentPlayer.position.set(player.position.x, player.position.y)
              independentPlayer.zIndex = view.container.zIndex + 1
              // Draw the unshielded view directly: a framebuffer-copy Sprite
              // would reapply native destination alpha to its body pixels.
              world.addChild(independentPlayer)
              render(world, expected)
              world.removeChild(independentPlayer)
              const frameComparison = comparePixels(pixels(actual), pixels(expected))
              const frameChanges = frameComparison.changedPixels
              const record = { fixture: fixture.name, element: player.config.element, program: player.primaryCast.selectedPrimaryId,
                weapon, handPose: weapon === null ? handPose : null, admitted,
                phase: player.lighting.overlayEffectPhase, arena, enhanced, heading, zoom, pulse,
                visibleEffects, effectCaptureChanges, captureChanges, frameChanges,
                maximumFrameChannelDifference: frameComparison.maximumChannelDifference }
              cases.push(record)
              if (player.config.element === 'earth' && arena && heading === 6 && pulse === 40) {
                images.push({ name: `stone-${weapon}-${enhanced ? 'on' : 'off'}-actual`, data: await app.renderer.extract.base64({ target: actual }) })
                images.push({ name: `stone-${weapon}-${enhanced ? 'on' : 'off'}-expected`, data: await app.renderer.extract.base64({ target: expected }) })
              }
            }
          }
          // The bit-1 suppression is specific to Stoneskin. Sibling captures
          // intentionally retain the shell from their ordinary body painter.
          for (const kind of ['harden', 'webbed', 'cocoon']) {
            const state = createNativeSecondaryPlayerState()
            player.progression.hardenCoating = kind === 'harden' ? 0.7 : 0
            const web = kind !== 'harden' ? { severity: kind === 'cocoon' ? 3 : 1,
              strength: 10, cocoonHealth: 0, hitPulse: 0 } : undefined
            const label = kind === 'harden' ? 'player-harden-coating' : 'player-webbed'
            update(state, true, web)
            const without = pixels(capture(view, label)).slice()
            update({ ...state, magicShieldAbsorb: 25, magicShieldMaximum: 25 }, true, web)
            const capturedShieldPixels = differences(without, pixels(capture(view, label)))
            render(world, actual)
            const outer = ['native-element-vfx-harden-overlay', 'player-damage-x4-vfx-harden-overlay']
              .map(label => view.container.getChildByLabel(label))
            const visible = outer.map(child => child.visible)
            for (const child of outer) child.visible = false
            const reference = ordinaryHelpers[0]
            const weapon = player.economy.equipment.weapon?.equipmentType ?? null
            const pose = fixture.castAction?.handPose ?? (fixture.spin ? 3
              : player.primaryCast.handCast1?.pose ?? (player.primaryCast.channelActive ? 2 : 0))
            const hand = handProgram.poses[pose][player.headingIndex]
            const admission = weapon !== null || hand[2] <= handProgram.referenceDepth
              && (pose !== 2 || player.primaryCast.channelActive)
            reference.container.visible = admission
            reference.container.zIndex = 9
            const socket = weapon === null ? { x: hand[0], y: Math.fround(hand[1]
              + Math.fround(Math.sin(Math.fround(8 * 3.141592502593994 / 180)))) }
              : weapon === 'wand' ? playerWandSpellEmitterOffset(player.headingIndex, 0)
                : playerStaffAttachmentOffset(player.headingIndex, 0)
            reference.container.position.set(socket.x, socket.y)
            const scale = Math.fround((weapon === null ? Math.fround(.8) : weapon === 'wand' ? Math.fround(.6) : 1)
              * (1 + 10 * player.lighting.overlayEffectPhase))
            reference.element.updateSelectedPrimary(player.primaryCast.selectedPrimaryId, 4, scale)
            reference.damage.update(100, 4, scale)
            view.container.addChild(reference.container)
            render(world, expected)
            view.container.removeChild(reference.container)
            outer.forEach((child, index) => { child.visible = visible[index] })
            const comparison = comparePixels(pixels(actual), pixels(expected))
            controls.push({ fixture: fixture.name, element: player.config.element, arena, kind,
              capturedShieldPixels, expectedOuter: admission, actualOuter: visible,
              changedPixels: comparison.changedPixels, maximumChannelDifference: comparison.maximumChannelDifference,
              cocoonOrder: kind !== 'cocoon' || view.container.getChildByLabel('player-webbed-cocoon')?.zIndex === 9.5 })
          }
          player.progression.hardenCoating = 0
          update(createNativeSecondaryPlayerState(), true)
          check(!view.container.getChildByLabel('player-stoneskin').visible, 'Stoneskin survives retirement')
          check(!view.magicShieldVisible, 'depleted shield survives retirement')
        } finally {
          view.destroy()
        }
      }
      const enchantTargets = Array.from({ length: 4 }, () => RenderTexture.create({
        width: 256, height: 256, alphaMode: 'no-premultiply-alpha',
      }))
      const transform = new Matrix(1, 0, 0, 1, 128, 153)
      const drawLayer = (container, target, clear, diffuse) => {
        const options = { container, target, clear, clearColor: [1, 1, 1, 0], transform }
        if (diffuse) renderNativeDiffuseMask(app.renderer, options)
        else app.renderer.render(options)
      }
      const attachment = new PlayerEnchantStaffView(textures.enchantStaff)
      try {
        for (let selector = 0; selector < 6; selector++) for (let pose = 0; pose < 10; pose++) for (let heading = 0; heading < 24; heading++) {
          const front = playerCharacterStaffIsFront(heading, pose)
          const side = front ? 'front' : 'back'
          const input = { headingIndex: heading, learnedSkills: [[65, 1, 1]], living: true,
            nativeStaff: true, pose, selectedPrimarySkillId: 16, selector,
            tick: 18 + heading + 24 * pose, weldBuildId: null, widthSample: heading % 3 * .75 }
          const body = new Sprite(textures.enchantStaff.bodies[selector][side][heading][pose])
          body.anchor.set(0.5)
          body.tint = 0x808080
          setNativeDiffuseColor(body, true)
          const hands = new Container()
          for (const lane of ['primary', 'secondary']) {
            const hand = new Sprite(textures.enchantStaff.hands[lane][side][heading][pose])
            hand.anchor.set(0.5)
            hand.tint = 0x808080
            setNativeDiffuseColor(hand, true)
            hands.addChild(hand)
          }
          let aura
          const auraPass = new Container()
          try {
            attachment.update(input, front)
            attachment.setMaterialTint(0x808080)
            drawLayer(attachment.container, enchantTargets[2], true, false)
            const drawCapture = () => drawLayer(attachment.container, enchantTargets[0], true, true)
            // The absent API is the pre-fix attachment's ordinary diffuse behavior.
            if (attachment.withDiffuseCapture) attachment.withDiffuseCapture(drawCapture)
            else drawCapture()
            const plan = nativeEnchantStaffDrawPlan(input)
            drawLayer(body, enchantTargets[1], true, false)
            if (plan?.auraRecord !== null && plan?.auraRecord !== undefined) {
              aura = new MeshSimple({ texture: textures.enchantStaff.auras[plan.auraRecord - 11],
                vertices: new Float32Array(plan.vertices),
                uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
                indices: new Uint32Array([0, 1, 2, 1, 2, 3]) })
              aura.blendMode = 'add'
              aura.geometry.batchMode = 'no-batch'
              setNativeVertexColors(aura, new Uint32Array([
                nativePackedColor(plan.tint, plan.nearAlpha), nativePackedColor(plan.tint, plan.nearAlpha),
                nativePackedColor(plan.tint, plan.farAlpha), nativePackedColor(plan.tint, plan.farAlpha),
              ]))
              // Pixi roots inherit normal blending; retain the native additive
              // gradient as a child of its independently submitted pass.
              auraPass.addChild(aura)
              drawLayer(auraPass, enchantTargets[1], false, false)
            }
            drawLayer(hands, enchantTargets[1], false, false)
            if (attachment.withDiffuseCapture) {
              try { attachment.withDiffuseCapture(() => { throw new Error('capture boundary probe') }) }
              catch (error) { check(error.message === 'capture boundary probe', 'unexpected capture failure') }
            }
            drawLayer(attachment.container, enchantTargets[3], true, false)
            const comparison = comparePixels(pixels(enchantTargets[0]), pixels(enchantTargets[1]))
            enchant.push({ selector, pose, heading, front, tick: input.tick, widthSample: input.widthSample,
              changedPixels: comparison.changedPixels,
              maximumChannelDifference: comparison.maximumChannelDifference,
              ordinaryRestorationChanges: differences(pixels(enchantTargets[2]), pixels(enchantTargets[3])) })
            if (selector === 0 && pose === 0 && heading === 6) {
              for (const [name, target] of [['enchant-capture-actual', enchantTargets[0]],
                ['enchant-capture-expected', enchantTargets[1]], ['enchant-ordinary-restored', enchantTargets[3]]]) {
                images.push({ name, data: await app.renderer.extract.base64({ target }) })
              }
            }
          } finally {
            body.destroy()
            hands.destroy({ children: true })
            if (aura) { const geometry = aura.geometry; aura.destroy(); geometry.destroy(true) }
            auraPass.destroy()
          }
        }
      } finally {
        attachment.destroy()
        for (const target of enchantTargets) target.destroy(true)
      }
      return { renderer: app.renderer.name, cases, controls, ordinary, enchant, images,
        comparisonBounds: { capturedPixels: 0, finalFrameChannel: 1 },
        inputs: { fixtures, handProgram, warpSeed: 331, warp, tick: 4, worldTint: 0xbfcfdf, stoneTicks: 100 }, qualifications: [
        'Real WebGL and the canonical complete Boneyard texture loader; controlled accepted-state fixtures.',
        'Actual College/Boneyard/native journeys remain separate from this composed renderer regression.',
        'Captured targets compare exactly. Independent parent/render-group raster routes allow one 8-bit channel LSB in the final frame; raw differences remain recorded.',
        'This validates recovered composition ownership; it does not replay the original reporter run.',
      ] }
    } finally {
      world.destroy({ children: true })
      shield.destroy()
      damage.destroy()
      orb.destroy()
      independentPlayer.destroy()
      for (const helper of ordinaryHelpers) {
        helper.element.destroy()
        helper.damage.destroy()
        helper.container.destroy()
      }
      for (const target of targets) target.destroy(true)
      mods.destroy()
      destroyBoneyardWorldTextures(textures)
      app.destroy({ removeView: true })
    }
  }, { fixtures: scope === 'all' ? fixtures : [], handProgram })
  for (const image of result.images) {
    await writeFile(`${output}/${image.name}.png`, Buffer.from(image.data.split(',')[1], 'base64'))
  }
  delete result.images
  await writeFile(`${output}/receipt.json`, `${JSON.stringify({ ...result, errors }, null, 2)}\n`)
  assert.deepEqual(errors, { page: [], console: [], network: [] })
  for (const element of scope === 'all' ? ['air', 'earth', 'ether', 'fire', 'water'] : []) {
    assert.ok(result.cases.some(record => record.element === element && record.visibleEffects.length > 0), `${element} has no live element-effect control`)
  }
  assert.ok(result.cases.every(record => record.effectCaptureChanges === 0), 'Stoneskin captured an independently drawn element or Damage X4 effect')
  assert.ok(result.cases.every(record => record.captureChanges === 0), 'Stoneskin captured the independent Magic Shield shell')
  assert.ok(result.cases.every(record => record.maximumFrameChannelDifference <= 1), 'the final frame differs beyond one 8-bit channel LSB from one independent effect and shell')
  assert.ok(result.controls.every(record => record.capturedShieldPixels > 0), 'a sibling material lost its native captured shell')
  assert.ok(result.controls.every(record => record.maximumChannelDifference <= 1), 'a sibling material differs from one independent outer helper')
  assert.ok(result.controls.every(record => record.cocoonOrder), 'Webbed cocoon does not follow the special helper and precede the shield')
  assert.ok(result.ordinary.every(record => record.maximumChannelDifference <= 1), 'ordinary effects differ from the independent native call matrix')
  assert.ok(result.enchant.every(record => record.maximumChannelDifference <= 1), 'Enchant capture differs from the native diffuse shaft / textured gradient / diffuse hands composition')
  assert.equal(result.enchant.length, 1440, 'the retained Enchant matrix is incomplete')
  assert.ok(result.enchant.every(record => record.ordinaryRestorationChanges === 0), 'Enchant capture did not restore ordinary rendering after failure')
  process.stdout.write(`${JSON.stringify({ cases: result.cases.length, controls: result.controls.length,
    ordinary: result.ordinary.length, enchant: result.enchant.length, scope, errors, output })}\n`)
} catch (error) {
  await writeFile(`${output}/failure.json`, `${JSON.stringify({ message: error.message, stack: error.stack, errors }, null, 2)}\n`)
  throw error
} finally {
  await browser?.close()
  await server.close()
}
