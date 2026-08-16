import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  NATIVE_SECONDARY_ABILITY_CONTRACTS,
  NATIVE_SECONDARY_ABILITY_IDS,
} from '../src/game/core-kernels/native-secondary-ability-contract.ts'
import {
  resetNativeSecondaryWorld,
} from '../src/game/core-kernels/native-secondary-abilities.ts'
import {
  getPlayerSkillBook,
} from '../src/game/core-server/game-simulation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_SECONDARY_ABILITY_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-secondary-abilities-20260816'
const chromePath = process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome'
const requestedSkillIds = (process.env.SDR_SECONDARY_ABILITY_ID || '')
  .split(',')
  .filter(Boolean)
  .map(Number)
const requestedScene = process.env.SDR_SECONDARY_ABILITY_SCENE || 'hub'
assert.ok(requestedScene === 'hub' || requestedScene === 'boneyard')

const PROOFS = Object.freeze({
  11: { audio: 'leviathan-roar', flash: true, kinds: ['leviathan', 'leviathan-appendage'] },
  12: { audio: 'planewalker-on', flash: true, kinds: ['plane-orb-particle', 'plane-orb-shot'] },
  15: { audio: 'phase', flash: true, kinds: ['phase-burst'] },
  21: { audio: 'big-fire', flash: true, kinds: ['moving-fire', 'shockwave'] },
  23: { audio: 'ignite', flash: true, kinds: ['fire-patch'] },
  27: { audio: 'magic-storm', flash: false, kinds: ['storm-cloud'] },
  30: { audio: 'prismatic-shock', flash: true, kinds: ['prismatic-wave'] },
  35: { audio: 'ring-of-ice', flash: true, kinds: ['freeze-wave', 'freeze-wave-visual'] },
  41: { audio: 'earthquake-loop', flash: true, kinds: ['earthquake'] },
  45: { audio: 'quake-crack-small', flash: false, kinds: ['golem'] },
  46: { audio: 'stoneskin-on', flash: true, kinds: [] },
  48: { audio: 'teleport', flash: true, kinds: ['teleport-burst'] },
  49: { audio: 'magic-circle', flash: true, kinds: ['magic-circle'] },
  50: { audio: 'set-trap', flash: true, kinds: ['magic-trap'] },
  51: { audio: 'dampen', flash: false, kinds: ['dampen-wave'] },
  54: { audio: 'magic-shield-up', flash: true, kinds: [] },
  72: { audio: 'magic-storm', flash: false, kinds: ['acid-rain'] },
  73: { audio: 'ignite', flash: true, kinds: ['fire-patch'] },
  74: { audio: 'distort-reality', flash: true, kinds: ['ether-drain'] },
  76: { audio: 'comet-loop', flash: false, kinds: ['comet', 'comet-trail'] },
  77: { audio: 'level-up', flash: false, kinds: ['turn-undead'] },
  78: { audio: 'mindstar', flash: true, kinds: [] },
  79: { audio: 'mindstar', flash: true, kinds: [] },
})

assert.deepEqual(
  Object.keys(PROOFS).map(Number),
  [...NATIVE_SECONDARY_ABILITY_IDS],
  'browser proof membership must stay closed over every native secondary ability',
)

await mkdir(screenshotRoot, { recursive: true })
const credential = 'secondary-ability-browser-parity'
const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its secondary-ability smoke port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: chromePath,
  headless: true,
})
const pageErrors = []
const consoleErrors = []

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(() => {
    const samples = []
    Object.defineProperty(window, '__secondaryRenderSamples', { value: samples })
    const observe = () => {
      const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
      const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
      if (frame) {
        samples.push({
          actorCount: frame.secondaryAbilityCount,
          flashAlpha: frame.secondaryScreenFlashAlpha,
          flashColor: frame.secondaryScreenFlashColor,
          frameCount: frame.frameCount,
          kinds: [...frame.secondaryAbilityKinds],
          magicShieldScale: frame.playerMagicShieldScale,
          magicShieldVisible: frame.playerMagicShieldVisible,
          materialTint: frame.playerMaterialTint,
          observedAtMs: performance.now(),
          primitiveCount: frame.secondaryAbilityPrimitiveCount,
          tick: frame.tick,
        })
        if (samples.length > 10_000) samples.shift()
      }
      requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })

  await enterHub(page, baseUrl)
  let canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  const playerId = host.hostPlayerId()
  assert.ok(playerId, 'the browser player must own the local authoritative host slot')
  const baseSkillBook = getPlayerSkillBook(host.state(), playerId)
  await waitUntil(
    () => host.state().secondaryAbilities.players[playerId] !== undefined,
    'secondary player state did not materialize',
  )

  armBelt(host, playerId, baseSkillBook, NATIVE_SECONDARY_ABILITY_IDS.slice(0, 8))
  await page.waitForFunction(() => (
    [...document.querySelectorAll('.hub-hud-secondary-slot')]
      .every((slot) => slot.querySelector('.hub-hud-secondary-skill-icon'))
  ))
  const beltReceipt = await captureBeltReceipt(page)
  await page.screenshot({ path: `${screenshotRoot}/secondary-belt-all-slots.png` })
  if (requestedScene === 'boneyard') {
    await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
      timeout: 90_000,
    })
    canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
    await canvas.waitFor({ timeout: 90_000 })
  }
  await page.setViewportSize({ width: 800, height: 450 })
  await page.waitForTimeout(250)

  const selectedContracts = requestedSkillIds.length === 0
    ? NATIVE_SECONDARY_ABILITY_CONTRACTS
    : NATIVE_SECONDARY_ABILITY_CONTRACTS.filter(({ skillId }) => (
      requestedSkillIds.includes(skillId)
    ))
  if (selectedContracts.length === 0) {
    throw new Error(`Unknown SDR_SECONDARY_ABILITY_ID ${requestedSkillIds.join(',')}`)
  }
  const receipts = []
  for (const contract of selectedContracts) {
    const proof = PROOFS[contract.skillId]
    await waitForFlashClear(page)
    await waitForStableHostCadence(host)
    armBelt(host, playerId, baseSkillBook, [contract.skillId])
    await waitForBeltSkill(page, contract.name)
    await waitForStableHostCadence(host)
    await waitForStablePresentationCadence(page)
    const castSequence = host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0
    const firstEventId = host.state().secondaryAbilities.nextEventId
    const sampleStart = await page.evaluate(() => window.__secondaryRenderSamples.length)
    const audioStart = await page.evaluate(() => window.__sdrAudioEvents.length)
    let target
    try {
      target = await canvas.evaluate((node) => {
        const bounds = node.getBoundingClientRect()
        return {
          x: bounds.left + bounds.width * 0.5,
          y: bounds.top + bounds.height * 0.4,
        }
      })
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        contract: { id: contract.skillId, name: contract.name },
        fatal: await page.evaluate(() => (
          document.querySelector('.game-runtime-error')?.textContent ?? null
        )),
      }, null, 2)}\n`)
      throw error
    }
    await page.mouse.move(target.x, target.y)
    await page.mouse.down({ button: 'right' })
    await page.waitForTimeout(35)
    await page.mouse.up({ button: 'right' })

    await waitUntil(() => {
      const player = host.state().secondaryAbilities.players[playerId]
      return player?.castSequence > castSequence && player.lastSkillId === contract.skillId
    }, `${contract.name} did not commit an authoritative cast`)
    await waitUntil(() => host.state().secondaryAbilities.events.some((event) => (
      event.eventId >= firstEventId && event.skillId === contract.skillId
    )), `${contract.name} emitted no authoritative semantic event`)
    const events = structuredClone(host.state().secondaryAbilities.events.filter((event) => (
      event.eventId >= firstEventId && event.skillId === contract.skillId
    )))
    let flashObservedAtCast = false
    if (proof.flash) {
      try {
        await page.waitForFunction(() => (
          ((document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
            ?.__sdrHubFrame
            ?? document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
              ?.__sdrBoneyardFrame)
            ?.secondaryScreenFlashAlpha ?? 0) > 0
        ), undefined, { timeout: 2_000 })
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          contract: { id: contract.skillId, name: contract.name },
          events,
          fatal: await page.evaluate(() => (
            document.querySelector('.game-runtime-error')?.textContent ?? null
          )),
          frame: await page.evaluate(() => {
            const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
            const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
            return frame ? { ...frame } : null
          }),
          recentSamples: await page.evaluate(() => window.__secondaryRenderSamples.slice(-20)),
        }, null, 2)}\n`)
        throw error
      }
      flashObservedAtCast = true
    }
    if (contract.skillId === 12) {
      await page.waitForFunction(() => (
        document.querySelector('.hub-hud-secondary-slot[data-slot="0"]')
          ?.getAttribute('aria-label')?.endsWith(', active')
      ))
      await page.mouse.down({ button: 'left' })
      await page.waitForTimeout(90)
      await page.mouse.up({ button: 'left' })
    }

    if (proof.kinds.length > 0) {
      try {
        await page.waitForFunction((expectedKinds) => {
          const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
          const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
          return frame
            && expectedKinds.every((kind) => frame.secondaryAbilityKinds.includes(kind))
            && frame.secondaryAbilityPrimitiveCount > 0
        }, proof.kinds, { timeout: 10_000 })
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          contract: { id: contract.skillId, name: contract.name },
          frame: await canvas.evaluate((node) => ({
            ...(node.__sdrHubFrame ?? node.__sdrBoneyardFrame),
          })),
          secondaryAbilities: host.state().secondaryAbilities,
        }, null, 2)}\n`)
        throw error
      }
    } else if (contract.skillId === 46 || contract.skillId === 54) {
      await waitForPlayerPresentation(page, contract.skillId)
    }

    let cooldownPath = null
    if (contract.skillId === 15 || contract.skillId === 48) {
      const path = page.locator(
        '.hub-hud-secondary-slot[data-slot="0"] .hub-hud-secondary-cooldown path',
      )
      await path.waitFor({ timeout: 2_000 })
      cooldownPath = await path.getAttribute('d')
      assert.ok(cooldownPath?.startsWith('M 26.5 26.5 L '))
    }
    const screenshotPath = `${screenshotRoot}/${String(contract.skillId).padStart(2, '0')}-${slug(contract.name)}.png`
    await page.screenshot({ path: screenshotPath })
    await waitForAudio(page, audioStart, proof.audio)
    await page.waitForTimeout(90)
    const samples = await page.evaluate(
      (start) => window.__secondaryRenderSamples.slice(start),
      sampleStart,
    )
    assert.ok(samples.length >= 2, `${contract.name} did not present multiple browser frames`)
    assert.ok(
      new Set(samples.map(({ tick }) => tick)).size >= 2,
      `${contract.name} did not advance across authoritative animation ticks`,
    )
    if (proof.kinds.length > 0) {
      assert.ok(
        samples.some(({ kinds }) => proof.kinds.every((kind) => kinds.includes(kind))),
        `${contract.name} never exposed its complete VFX kind set`,
      )
      assert.ok(
        samples.some(({ primitiveCount }) => primitiveCount > 0),
        `${contract.name} created no WebGL presentation primitives`,
      )
    }
    const flashObserved = flashObservedAtCast
      || samples.some(({ flashAlpha }) => flashAlpha > 0)
    assert.equal(
      flashObserved,
      proof.flash,
      `${contract.name} Region flash ownership diverged`,
    )
    assert.ok(
      events.some(({ skillId }) => skillId === contract.skillId),
      `${contract.name} emitted no replicated semantic event`,
    )
    const player = host.state().secondaryAbilities.players[playerId]
    assertPlayerState(contract.skillId, player)
    receipts.push({
      audio: proof.audio,
      cooldownPath,
      eventCues: events.flatMap(({ cue }) => cue === null ? [] : [cue]),
      flashObserved,
      id: contract.skillId,
      kinds: [...new Set(samples.flatMap(({ kinds }) => kinds))].sort(),
      maximumActorCount: Math.max(...samples.map(({ actorCount }) => actorCount)),
      maximumPrimitiveCount: Math.max(...samples.map(({ primitiveCount }) => primitiveCount)),
      name: contract.name,
      screenshotPath,
      ticksObserved: new Set(samples.map(({ tick }) => tick).filter(Number.isFinite)).size,
    })
    resetSecondaryWorld(host)
    try {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
        const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
        return frame?.secondaryAbilityCount === 0
      })
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        contract: { id: contract.skillId, name: contract.name },
        fatal: await page.evaluate(() => (
          document.querySelector('.game-runtime-error')?.textContent ?? null
        )),
        frame: await page.evaluate(() => {
          const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
          const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
          return frame ? { ...frame } : null
        }),
      }, null, 2)}\n`)
      throw error
    }
  }

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    belt: beltReceipt,
    browser: await canvas.evaluate((node) => ({
      context: (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name,
      rendererName: node.dataset.rendererName,
    })),
    consoleErrors,
    pageErrors,
    receipts,
    scene: requestedScene,
    screenshotRoot,
  }, null, 2)}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function enterHub(page, baseUrl) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Fire' }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await Promise.all([
    page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 }),
    page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({
      timeout: 60_000,
    }),
  ])
  await page.waitForTimeout(250)
}

function armBelt(host, playerId, baseSkillBook, skillIds) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  assert.notEqual(index, -1)
  const permanentRanks = [...baseSkillBook.permanentRanks]
  const effectiveRanks = [...baseSkillBook.effectiveRanks]
  for (const skillId of skillIds) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
  }
  const secondaryBelt = Object.freeze(Array.from(
    { length: 8 },
    (_, slot) => skillIds[slot] ?? null,
  ))
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...baseSkillBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
    secondaryBelt,
  }
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentMana: 10_000,
    maximumMana: 10_000,
    pendingOffer: null,
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
      skillBooks: Object.freeze(skillBooks),
    },
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
  })
}

function resetSecondaryWorld(host) {
  const state = host.state()
  Object.assign(state, {
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
  })
}

async function captureBeltReceipt(page) {
  const slots = await page.locator('.hub-hud-secondary-slot').evaluateAll((nodes) => (
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect()
      const icon = node.querySelector('.hub-hud-secondary-skill-icon')
      const backing = node.querySelector('.hub-hud-secondary-key-backing')
      const mouse = node.querySelector('.hub-hud-secondary-input-mouse')
      return {
        height: bounds.height,
        iconFilter: icon ? getComputedStyle(icon).filter : null,
        iconOpacity: icon ? getComputedStyle(icon).opacity : null,
        keyBackingHeight: backing?.getBoundingClientRect().height ?? null,
        keyBackingWidth: backing?.getBoundingClientRect().width ?? null,
        label: node.getAttribute('aria-label'),
        mouseOpacity: mouse ? getComputedStyle(mouse).opacity : null,
        slot: Number(node.getAttribute('data-slot')),
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      }
    })
  ))
  assert.equal(slots.length, 8)
  const offsets = [-332, -272, -212, -152, 98, 158, 218, 278]
  for (const slot of slots) {
    assert.equal(slot.width, 53)
    assert.equal(slot.height, 53)
    assert.ok(Math.abs(slot.x - (800 + offsets[slot.slot])) < 0.01)
    assert.ok(Math.abs(slot.y - 832.5) < 0.01)
    assert.equal(slot.iconFilter, 'brightness(0.25)')
    assert.equal(slot.iconOpacity, '0.375')
    if (slot.slot === 0) {
      assert.equal(slot.mouseOpacity, '0.6')
      assert.equal(slot.keyBackingWidth, null)
    } else {
      assert.equal(slot.keyBackingWidth, 13)
      assert.equal(slot.keyBackingHeight, 15)
    }
  }
  return slots
}

async function waitForBeltSkill(page, name) {
  await page.waitForFunction((expectedName) => (
    document.querySelector('.hub-hud-secondary-slot[data-slot="0"]')
      ?.getAttribute('aria-label')?.startsWith(`${expectedName}, right mouse button`)
  ), name, { timeout: 10_000 })
}

async function waitForPlayerPresentation(page, skillId) {
  await page.waitForFunction((id) => {
    const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
    const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
    if (!frame) return false
    if (id === 46) return frame.playerMaterialTint === 0x808080
    return frame.playerMagicShieldVisible && frame.playerMagicShieldScale >= 1.5
  }, skillId, { timeout: 10_000 })
}

async function waitForAudio(page, start, stem) {
  await page.waitForFunction(({ eventStart, expectedStem }) => (
    window.__sdrAudioEvents.slice(eventStart).some((event) => (
      (event.type === 'buffer-start' || event.type === 'play')
      && window.__sdrAudioSourceMatches(event.src, `/game/audio/sfx/${expectedStem}.wav`)
    ))
  ), { eventStart: start, expectedStem: stem }, { timeout: 10_000 })
}

async function waitForFlashClear(page) {
  await page.waitForFunction(() => (
    ((document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
      ?.__sdrHubFrame
      ?? document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
        ?.__sdrBoneyardFrame)
      ?.secondaryScreenFlashAlpha ?? 0) === 0
  ), undefined, { timeout: 10_000 })
}

function assertPlayerState(skillId, player) {
  assert.ok(player)
  if (skillId === 12) assert.ok(player.planewalkerTicksRemaining > 0)
  if (skillId === 23) assert.equal(player.firewalker, true)
  if (skillId === 46) assert.ok(player.stoneskinTicksRemaining > 0)
  if (skillId === 54) assert.ok(player.magicShieldAbsorb > 0)
  if (skillId === 78) assert.equal(player.mindstar, true)
  if (skillId === 79) assert.equal(player.regenerate, true)
}

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

async function waitForStableHostCadence(host) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const start = host.state().tick
    await new Promise((resolve) => setTimeout(resolve, 100))
    const advanced = host.state().tick - start
    if (advanced >= 5 && advanced <= 15) return
  }
  throw new Error('the in-process game host did not return to its 100 Hz cadence')
}

async function waitForStablePresentationCadence(page) {
  await page.waitForFunction(() => {
    const distinct = []
    for (let index = window.__secondaryRenderSamples.length - 1; index >= 0; index -= 1) {
      const sample = window.__secondaryRenderSamples[index]
      if (!sample || distinct.some(({ frameCount }) => frameCount === sample.frameCount)) continue
      distinct.push(sample)
      if (distinct.length === 4) break
    }
    if (distinct.length < 4) return false
    distinct.reverse()
    return distinct.every((sample, index) => {
      if (index === 0) return true
      const previous = distinct[index - 1]
      return sample.frameCount > previous.frameCount
        && sample.tick >= previous.tick
        && sample.tick - previous.tick <= 8
        && sample.observedAtMs - previous.observedAtMs <= 100
    })
  }, undefined, { timeout: 30_000 })
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
