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
  DOWSING_EQUIPMENT_RECIPES,
  createEquipmentInventoryItem,
} from '../src/game/core-kernels/hub-economy.ts'
import {
  nativeSecondaryCooldownCapacityTicks,
  resetNativeSecondaryWorld,
} from '../src/game/core-kernels/native-secondary-abilities.ts'
import { createPrimarySpellSimulation } from '../src/game/core-kernels/primary-spells.ts'
import {
  canPlaceBoneyardBody,
  firstBoneyardPathBlockProgress,
  withBoneyardGateCollision,
} from '../src/game/core-server/boneyard-collision.ts'
import {
  getPlayerSkillBook,
} from '../src/game/core-server/game-simulation.ts'
import {
  replacePlayerEconomy,
  selectPlayerEntityPrimarySkill,
} from '../src/game/core-server/player-entity-store.ts'
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
const comparisonCapture = process.env.SDR_SECONDARY_ABILITY_COMPARISON_CAPTURE === '1'
const retainNativeViewport = process.env.SDR_SECONDARY_ABILITY_NATIVE_VIEWPORT === '1'
const cooldownOnly = process.env.SDR_SECONDARY_COOLDOWN_ONLY === '1'
const singleGolemCapture = process.env.SDR_SECONDARY_GOLEM_SINGLE === '1'
const golemCooldownTiming = process.env.SDR_SECONDARY_GOLEM_COOLDOWN_TIMING === '1'
const statusEffectAcceptance = process.env.SDR_STATUS_EFFECT_ACCEPTANCE === '1'
assert.ok(requestedScene === 'hub' || requestedScene === 'boneyard')
if (comparisonCapture) assert.equal(retainNativeViewport, true)
if (statusEffectAcceptance) assert.equal(requestedScene, 'boneyard')

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
const MAXIMUM_SET_RECIPES = new Map([
  [11, [11, 12, 13, 14, 15]],
  [21, [20, 21]],
  [27, [16, 17, 18, 19]],
  [35, [22, 23, 24]],
  [76, [22, 23, 24]],
  [45, [25, 26, 27, 28]],
])
const COMBAT_PROOF_SKILLS = new Set([11, 21, 27, 35, 45, 72, 76])

assert.deepEqual(
  Object.keys(PROOFS).map(Number),
  [...NATIVE_SECONDARY_ABILITY_IDS],
  'browser proof membership must stay closed over every native secondary ability',
)

await mkdir(screenshotRoot, { recursive: true })
const credential = 'secondary-ability-browser-parity'
const externalBaseUrl = process.env.SDR_SECONDARY_ABILITY_BASE_URL?.replace(/\/$/, '')
let vite = null
let baseUrl = externalBaseUrl
if (!baseUrl) {
  vite = await createViteServer({
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
  baseUrl = `http://127.0.0.1:${viteAddress.port}`
}
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
const responseErrors = []

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.route('**/deployment.json*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({
      body: JSON.stringify({ revision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      responseErrors.push({ status: response.status(), url: response.url() })
    }
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
          actors: frame.secondaryAbilitySamples.map((actor) => ({ ...actor })),
          cameraMagnitude: Number(canvas.dataset.secondaryCameraMagnitude || 0),
          cameraZoom: frame.cameraZoom,
          flashAlpha: frame.secondaryScreenFlashAlpha,
          flashColor: frame.secondaryScreenFlashColor,
          frameCount: frame.frameCount,
          kinds: [...frame.secondaryAbilityKinds],
          magicShieldScale: frame.playerMagicShieldScale,
          magicShieldVisible: frame.playerMagicShieldVisible,
          materialTint: frame.playerMaterialTint,
          observedAtMs: performance.now(),
          playerAttachmentPose: frame.playerAttachmentPose,
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
  const baseEquipment = structuredClone(playerEconomy(host, playerId).equipment)
  await waitUntil(
    () => host.state().secondaryAbilities.players[playerId] !== undefined,
    'secondary player state did not materialize',
  )

  armQuickbar(host, playerId, baseSkillBook, NATIVE_SECONDARY_ABILITY_IDS.slice(0, 8))
  await page.waitForFunction(() => {
    const slots = [...document.querySelectorAll('.hub-hud-quickbar-slot')]
    return slots.length === 8
      && slots.every((slot) => slot.querySelector('.hub-hud-quickbar-skill-icon'))
  })
  const beltReceipt = await captureBeltReceipt(page)
  await page.screenshot({ path: `${screenshotRoot}/secondary-belt-all-slots.png` })
  let boneyardEnemyBaseline = null
  if (requestedScene === 'boneyard') {
    await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
      timeout: 90_000,
    })
    canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
    await canvas.waitFor({ timeout: 90_000 })
    await openBoneyardCombat(page, host, playerId)
    if (cooldownOnly) stabilizeBoneyardCooldownEnemies(host)
    const state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    boneyardEnemyBaseline = structuredClone(state.world.enemies)
  }
  const statusEffects = statusEffectAcceptance
    ? await capturePrimaryStatusEffectExpiry(
        page,
        canvas,
        host,
        playerId,
        baseSkillBook,
        boneyardEnemyBaseline,
      )
    : null
  if (!retainNativeViewport) await page.setViewportSize({ width: 800, height: 450 })
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
    if (boneyardEnemyBaseline) restoreBoneyardEnemies(host, boneyardEnemyBaseline)
    const proof = PROOFS[contract.skillId]
    await waitForFlashClear(page)
    await waitForStableHostCadence(host)
    armMaximumSet(host, playerId, contract.skillId, baseEquipment)
    armQuickbar(
      host,
      playerId,
      baseSkillBook,
      [contract.skillId],
      contract.skillId === 11 ? 5 : 1,
    )
    await waitForBeltSkill(page, contract.name)
    await waitForStableHostCadence(host)
    await waitForStablePresentationCadence(page)
    const castSequence = host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0
    const firstEventId = host.state().secondaryAbilities.nextEventId
    const sampleStart = await page.evaluate(() => window.__secondaryRenderSamples.length)
    const materialTintBeforeCast = await page.evaluate(() => (
      window.__secondaryRenderSamples.at(-1)?.materialTint ?? null
    ))
    const audioStart = await page.evaluate(() => window.__sdrAudioEvents.length)
    const castRequestedAtMs = performance.now()
    const castRequestedAtTick = host.state().tick
    const manaBeforeCast = playerProgression(host, playerId).currentMana
    let target
    let combatBaseline = null
    try {
      const castTarget = await abilityCastTarget(
        canvas,
        host,
        playerId,
        contract.skillId,
        requestedScene,
      )
      target = castTarget.pointer
      combatBaseline = castTarget.combatBaseline
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        contract: { id: contract.skillId, name: contract.name },
        fatal: await page.evaluate(() => (
          document.querySelector('.game-runtime-error')?.textContent ?? null
        )),
      }, null, 2)}\n`)
      throw error
    }
    await castSecondaryPointer(page, target)

    try {
      await waitUntil(() => {
        const player = host.state().secondaryAbilities.players[playerId]
        return player?.castSequence > castSequence && player.lastSkillId === contract.skillId
      }, `${contract.name} did not commit an authoritative cast`)
    } catch (error) {
      const state = host.state()
      const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
      process.stderr.write(`${JSON.stringify({
        castFailure: {
          input: state.inputs?.[playerId] ?? null,
          player: state.secondaryAbilities.players[playerId] ?? null,
          progression: state.playerEntities.progressions[index],
          run: state.run,
          worldKind: state.world.kind,
        },
      }, null, 2)}\n`)
      throw error
    }
    const committedState = host.state()
    const committedPlayer = structuredClone(
      committedState.secondaryAbilities.players[playerId],
    )
    const committedPlayerIndex = committedState.playerEntities.identities.findIndex(
      ({ playerId: id }) => id === playerId,
    )
    assert.notEqual(committedPlayerIndex, -1)
    const castCommittedAtMs = performance.now()
    const castCommittedAtTick = committedState.tick
    const manaAfterCast = committedState.playerEntities
      .progressions[committedPlayerIndex].currentMana
    positionCombatTargetForAbility(host, contract.skillId, combatBaseline)
    await waitUntil(() => host.state().secondaryAbilities.events.some((event) => (
      event.eventId >= firstEventId && event.skillId === contract.skillId
    )), `${contract.name} emitted no authoritative semantic event`)
    const events = structuredClone(host.state().secondaryAbilities.events.filter((event) => (
      event.eventId >= firstEventId && event.skillId === contract.skillId
    )))
    const authoritativeCastTick = Math.min(...events.map(({ tick }) => tick))
    const expectedCooldownCapacity = nativeSecondaryCooldownCapacityTicks(
      getPlayerSkillBook(committedState, playerId),
      contract.skillId,
    )
    assert.equal(
      committedPlayer?.cooldownMaximumTicksBySkill[contract.skillId],
      expectedCooldownCapacity,
    )
    let cooldownPath = null
    if (contract.skillId === 78 || contract.skillId === 79) {
      assert.equal(committedPlayer?.cooldownTicksBySkill[contract.skillId], 0)
      assert.equal(committedPlayer?.globalCooldownTicks, 0)
      assert.equal(await page.locator(
        '.hub-hud-quickbar-slot[data-slot="0"] .hub-hud-quickbar-cooldown path',
      ).count(), 0)
    } else {
      const path = page.locator(
        '.hub-hud-quickbar-slot[data-slot="0"] .hub-hud-quickbar-cooldown path',
      )
      await path.waitFor({ timeout: 2_000 })
      cooldownPath = await path.getAttribute('d')
      assert.ok(cooldownPath?.startsWith('M 26.5 26.5 L '))
      assert.ok((committedPlayer?.globalCooldownTicks ?? 0) > 0)
      const rowCurrent = committedPlayer?.cooldownTicksBySkill[contract.skillId] ?? 0
      if (expectedCooldownCapacity < 150) {
        assert.equal(rowCurrent, 0)
      } else {
        assert.ok(rowCurrent > expectedCooldownCapacity - 20)
        assert.ok(rowCurrent <= expectedCooldownCapacity)
      }
      assert.match(
        (await page.locator(
          '.hub-hud-quickbar-slot[data-slot="0"]',
        ).getAttribute('aria-label')) ?? '',
        /cooldown remaining/,
      )
    }
    const cooldownAtCast = {
      capacityTicks: expectedCooldownCapacity,
      authoritativeCastTick,
      committedAtMs: castCommittedAtMs,
      committedAtTick: castCommittedAtTick,
      commonTicks: committedPlayer?.globalCooldownTicks ?? 0,
      manaBefore: manaBeforeCast,
      manaAfter: manaAfterCast,
      path: cooldownPath,
      requestedAtMs: castRequestedAtMs,
      requestedAtTick: castRequestedAtTick,
      rowTicks: committedPlayer?.cooldownTicksBySkill[contract.skillId] ?? 0,
    }
    let maximumSet = contract.skillId === 45
      ? null
      : maximumSetReceipt(host.state(), playerId, contract.skillId)
    let cooldownTiming = null
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
        document.querySelector('.hub-hud-quickbar-slot[data-slot="0"]')
          ?.getAttribute('aria-label')?.endsWith(', active')
      ))
      await castPrimaryPointer(page, target)
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
    }
    if (contract.skillId === 72) {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
        const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
        return frame?.secondaryAbilityKinds.includes('acid-drop')
          && frame.secondaryAbilityKinds.includes('acid-splash')
          && frame.secondaryAbilitySamples.some(({ kind, underlayPrimitiveCount }) => (
            kind === 'acid-rain' && underlayPrimitiveCount === 1
          ))
      }, undefined, { timeout: 5_000 })
    }
    let playerPresentation = null
    if (contract.skillId === 46 || contract.skillId === 54) {
      playerPresentation = await waitForPlayerPresentation(
        page,
        contract.skillId,
        materialTintBeforeCast,
      )
    }
    if (contract.skillId === 45) {
      if (golemCooldownTiming) {
        assert.equal(expectedCooldownCapacity, 2_500)
        assert.ok(manaBeforeCast - cooldownAtCast.manaAfter >= 59.5)
        assert.ok(manaBeforeCast - cooldownAtCast.manaAfter <= 60.5)
        await page.screenshot({
          path: `${screenshotRoot}/45-raise-golem-cooldown-full.png`,
        })
        await waitUntil(() => {
          const player = host.state().secondaryAbilities.players[playerId]
          const row = player?.cooldownTicksBySkill[45] ?? 0
          return (player?.staffCastTicksRemaining ?? 0) === 0
            && (player?.globalCooldownTicks ?? 0) === 0
            && row > 0
            && row <= 1_250
        }, 'Raise Golem did not reach its half-cooldown row', 20_000)
        await page.screenshot({
          path: `${screenshotRoot}/45-raise-golem-cooldown-half.png`,
        })
        const blockedSequence = host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0
        const blockedFizzle = host.state().secondaryAbilities.players[playerId]?.fizzleSequence ?? 0
        await castSecondaryPointer(page, { x: target.x + 20, y: target.y })
        await waitUntil(() => (
          (host.state().secondaryAbilities.players[playerId]?.fizzleSequence ?? 0)
            > blockedFizzle
        ), 'Raise Golem row cooldown did not reject a second input')
        assert.equal(
          host.state().secondaryAbilities.players[playerId]?.castSequence,
          blockedSequence,
        )
        await waitUntil(() => (
          (host.state().secondaryAbilities.players[playerId]?.cooldownTicksBySkill[45] ?? 0) === 0
        ), 'Raise Golem did not reach cooldown zero', 20_000)
        const zeroAtMs = performance.now()
        const zeroAtTick = host.state().tick
        const elapsedTicks = zeroAtTick - cooldownAtCast.authoritativeCastTick
        const elapsedMs = zeroAtMs - castRequestedAtMs
        assert.ok(elapsedTicks >= 2_500 && elapsedTicks <= 2_505)
        assert.ok(elapsedMs >= 24_500 && elapsedMs <= 27_500)
        assert.equal(await page.locator(
          '.hub-hud-quickbar-slot[data-slot="0"] .hub-hud-quickbar-cooldown path',
        ).count(), 0)
        await page.screenshot({
          path: `${screenshotRoot}/45-raise-golem-cooldown-zero.png`,
        })
        const readySequence = host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0
        await castSecondaryPointer(page, { x: target.x + 40, y: target.y })
        await waitUntil(() => (
          (host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0)
            > readySequence
        ), 'Raise Golem did not accept the first post-cooldown input')
        cooldownTiming = {
          acceptedAfterZero: true,
          blockedAtHalf: true,
          elapsedMs,
          elapsedTicks,
          manaDebit: manaBeforeCast - cooldownAtCast.manaAfter,
          zeroAtTick,
        }
      }
      if (singleGolemCapture) {
        const golem = host.state().secondaryAbilities.actors.find(({ kind, ownerId }) => (
          kind === 'golem' && ownerId === playerId
        ))
        assert.ok(golem)
        for (const ageTicks of [2, 50, 100, 200, 400]) {
          await waitUntil(() => (
            (host.state().secondaryAbilities.actors.find(({ id }) => id === golem.id)?.ageTicks ?? 0)
              >= ageTicks
          ), `single Golem did not reach age ${ageTicks}`, 10_000)
          await page.screenshot({
            path: `${screenshotRoot}/45-raise-golem-age-${ageTicks}.png`,
          })
        }
        maximumSet = { expectedSummonCap: 1, summons: 1 }
      } else if (!golemCooldownTiming) {
        await waitUntil(() => {
          const player = host.state().secondaryAbilities.players[playerId]
          return (player?.staffCastTicksRemaining ?? 0) === 0
            && (player?.castSpinTicksRemaining ?? 0) === 0
            && (player?.globalCooldownTicks ?? 0) === 0
            && (player?.cooldownTicksBySkill[45] ?? 0) === 0
        }, 'Raise Golem cast gates did not release before the second cast')
        const secondCastSequence = host.state().secondaryAbilities.players[playerId]
          ?.castSequence ?? 0
        await castSecondaryPointer(page, { x: target.x + 40, y: target.y })
        await waitUntil(() => (
          (host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0)
            > secondCastSequence
          && host.state().secondaryAbilities.actors.filter(({ kind, ownerId }) => (
            kind === 'golem' && ownerId === playerId
          )).length === 2
          && host.state().secondaryAbilities.actors.filter(({ kind, ownerId }) => (
            kind === 'golem' && ownerId === playerId
          )).every(({ ageTicks }) => ageTicks >= 400)
        ), 'Fete of Clay did not retain and assemble two authoritative Golems', 10_000)
        maximumSet = maximumSetReceipt(host.state(), playerId, contract.skillId)
      }
    }
    const combatProof = cooldownOnly
      ? null
      : await collectCombatProof(
          host,
          playerId,
          contract.skillId,
          combatBaseline,
          requestedScene,
        )
    if (combatProof && contract.skillId === 35) {
      await page.waitForFunction(() => (
        ((document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame)
          ?.secondaryScreenFlashAlpha ?? 1) <= 0.1
      ), undefined, { timeout: 2_000 })
    } else if (combatProof) {
      await page.waitForTimeout(120)
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
    if (contract.skillId !== 78 && contract.skillId !== 79) {
      assert.ok(
        samples.some(({ playerAttachmentPose }) => playerAttachmentPose === 9),
        `${contract.name} never presented its native Cast2 pose`,
      )
    }
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
    const expectedFlash = proof.flash || (combatProof !== null && contract.skillId === 76)
    assert.equal(
      flashObserved,
      expectedFlash,
      `${contract.name} Region flash ownership diverged`,
    )
    assert.ok(
      events.some(({ skillId }) => skillId === contract.skillId),
      `${contract.name} emitted no replicated semantic event`,
    )
    if (combatProof && contract.skillId === 21) {
      assert.equal(samples.some(({ kinds }) => kinds.includes('ring-fire-explosion')), true)
      assert.equal(samples.some(({ kinds }) => kinds.includes('ring-fire-fragment')), true)
    }
    if (combatProof && contract.skillId === 35) {
      assert.equal(samples.some(({ kinds }) => kinds.includes('frost-burn-flare')), true)
    }
    const player = host.state().secondaryAbilities.players[playerId]
    assertPlayerState(contract.skillId, player)
    const reportedPresentation = assertReportedPresentation(
      host.state(),
      playerId,
      contract.skillId,
      samples,
    )
    receipts.push({
      audio: proof.audio,
      cooldownAtCast,
      cooldownPath,
      cooldownTiming,
      combatProof,
      eventCues: events.flatMap(({ cue }) => cue === null ? [] : [cue]),
      flashObserved,
      id: contract.skillId,
      kinds: [...new Set(samples.flatMap(({ kinds }) => kinds))].sort(),
      maximumActorCount: Math.max(...samples.map(({ actorCount }) => actorCount)),
      maximumPrimitiveCount: Math.max(...samples.map(({ primitiveCount }) => primitiveCount)),
      maximumSet,
      name: contract.name,
      playerPresentation,
      reportedPresentation,
      screenshotPath,
      ticksObserved: new Set(samples.map(({ tick }) => tick).filter(Number.isFinite)).size,
    })
    await resetSecondaryWorld(host)
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
  assert.deepEqual({ consoleErrors, responseErrors }, { consoleErrors: [], responseErrors: [] })
  process.stdout.write(`${JSON.stringify({
    belt: beltReceipt,
    browser: await canvas.evaluate((node) => ({
      context: (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name,
      rendererName: node.dataset.rendererName,
    })),
    consoleErrors,
    pageErrors,
    receipts,
    responseErrors,
    scene: requestedScene,
    screenshotRoot,
    statusEffects,
  }, null, 2)}\n`)
} finally {
  await host.close()
  await browser.close()
  await vite?.close()
}

async function capturePrimaryStatusEffectExpiry(
  page,
  canvas,
  host,
  playerId,
  baseSkillBook,
  enemyBaseline,
) {
  assert.ok(enemyBaseline, 'status-effect acceptance requires a Boneyard enemy baseline')
  const receipts = []
  for (const testCase of [
    {
      active: (effect) => (effect?.coldSlowTicks ?? 0) > 0,
      name: 'frost-jet',
      primarySkillId: 32,
      ranks: [[32, 1]],
    },
    {
      active: (effect) => (effect?.stunTicks ?? 0) > 0,
      name: 'lightning-stun',
      primarySkillId: 24,
      ranks: [[24, 1], [26, 10]],
    },
  ]) {
    await releasePrimaryPointer(page)
    armPrimaryStatusSkill(host, playerId, baseSkillBook, testCase)
    const target = preparePrimaryStatusTarget(host, playerId, enemyBaseline)
    const pointer = await primaryStatusTargetPointer(page, canvas, target)
    await pressPrimaryPointer(page, pointer)
    let activeEffect
    try {
      try {
        await waitUntil(() => {
          const state = host.state()
          activeEffect = state.secondaryAbilities.targetEffects.find(({ targetId, worldKey }) => (
            targetId === target.id && worldKey === target.worldKey
          ))
          return testCase.active(activeEffect)
        }, `${testCase.name} did not attach its target-owned modifier`, 10_000)
      } catch (error) {
        const state = host.state()
        const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => (
          id === playerId
        ))
        process.stderr.write(`${JSON.stringify({
          statusEffectCastFailure: {
            combatEnabled: state.world.kind === 'boneyard'
              ? (state.world.encounter?.runEventId ?? 0) > 0
              : false,
            frame: await canvas.evaluate(node => structuredClone(node.__sdrBoneyardFrame)),
            input: state.inputs?.[playerId] ?? null,
            player: state.players?.[playerId] ?? null,
            primaryCast: state.playerEntities.primaryCasts[playerIndex] ?? null,
            primarySkillId: state.playerEntities.skillBooks[playerIndex]?.primarySkillId ?? null,
            primarySpells: state.primarySpells,
            pointer,
            target: state.world.kind === 'boneyard'
              ? state.world.enemies.actors.find(({ id }) => id === target.id) ?? null
              : null,
            targetEffects: state.secondaryAbilities.targetEffects,
            testCase,
            tick: state.tick,
          },
        }, null, 2)}\n`)
        throw error
      }
      const state = host.state()
      assert.equal(state.world.kind, 'boneyard')
      const enemy = state.world.enemies.actors.find(({ id }) => id === target.id)
      assert.ok(enemy, `${testCase.name} target retired during its modifier`)
      assert.deepEqual(enemy.config, target.authoredConfig)
      enablePrimaryStatusTargetMovement(host, target.id)
      if (testCase.name === 'frost-jet') {
        assert.equal(activeEffect.coldSlowMaterial, true)
        assert.ok(activeEffect.timeScale > 0 && activeEffect.timeScale < 1)
      } else {
        assert.equal(activeEffect.timeScale, 0)
        const heldPosition = { ...enemy.position }
        await new Promise((resolve) => setTimeout(resolve, 120))
        const heldState = host.state()
        assert.equal(heldState.world.kind, 'boneyard')
        const heldEnemy = heldState.world.enemies.actors.find(({ id }) => id === target.id)
        assert.ok(heldEnemy)
        assert.equal(squaredDistance(heldEnemy.position, heldPosition), 0)
      }
      await page.screenshot({
        path: `${screenshotRoot}/status-${testCase.name}-active.png`,
      })
    } finally {
      await releasePrimaryPointer(page)
    }

    const releaseTick = host.state().tick
    await waitUntil(() => {
      const effect = host.state().secondaryAbilities.targetEffects.find(({ targetId, worldKey }) => (
        targetId === target.id && worldKey === target.worldKey
      ))
      return !testCase.active(effect)
    }, `${testCase.name} modifier did not expire after release`, 15_000)
    const expiredState = host.state()
    assert.equal(expiredState.world.kind, 'boneyard')
    const expiredEnemy = expiredState.world.enemies.actors.find(({ id }) => id === target.id)
    assert.ok(expiredEnemy, `${testCase.name} target retired before recovery`)
    assert.deepEqual(expiredEnemy.config, target.authoredConfig)
    const expiredPosition = { ...expiredEnemy.position }
    await waitUntil(() => {
      const state = host.state()
      if (state.world.kind !== 'boneyard') return false
      const enemy = state.world.enemies.actors.find(({ id }) => id === target.id)
      return enemy !== undefined && squaredDistance(enemy.position, expiredPosition) > 0.01
    }, `${testCase.name} target did not resume movement after expiry`, 5_000)
    const recoveredState = host.state()
    assert.equal(recoveredState.world.kind, 'boneyard')
    const recoveredEnemy = recoveredState.world.enemies.actors.find(({ id }) => id === target.id)
    assert.ok(recoveredEnemy)
    assert.deepEqual(recoveredEnemy.config, target.authoredConfig)
    const recoveryDistance = Math.sqrt(squaredDistance(
      recoveredEnemy.position,
      expiredPosition,
    ))
    const recoveredScreenshotPath = `${screenshotRoot}/status-${testCase.name}-recovered.png`
    await page.screenshot({ path: recoveredScreenshotPath })
    receipts.push({
      activeEffect: structuredClone(activeEffect),
      activeScreenshotPath: `${screenshotRoot}/status-${testCase.name}-active.png`,
      authoredConfigPreserved: true,
      enemyId: target.id,
      name: testCase.name,
      recoveredScreenshotPath,
      recoveredTick: recoveredState.tick,
      recoveryDistance,
      releaseTick,
    })
  }
  return receipts
}

function armPrimaryStatusSkill(host, playerId, baseSkillBook, testCase) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const permanentRanks = [...baseSkillBook.permanentRanks]
  const effectiveRanks = [...baseSkillBook.effectiveRanks]
  const learnedSkillOrder = [...baseSkillBook.learnedSkillOrder]
  for (const [skillId, rank] of testCase.ranks) {
    permanentRanks[skillId] = rank
    effectiveRanks[skillId] = rank
    if (!learnedSkillOrder.includes(skillId)) learnedSkillOrder.push(skillId)
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...baseSkillBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: Object.freeze(learnedSkillOrder),
    permanentRanks: Object.freeze(permanentRanks),
    skillQuickbar: Object.freeze([
      testCase.primarySkillId, null, null, null, null, null, null, null,
    ]),
  }
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: 1_000_000,
    currentMana: 10_000,
    deathEpoch: 0,
    deathTick: 0,
    lifeState: 'alive',
    maximumHealth: 1_000_000,
    maximumMana: 10_000,
    pendingOffer: null,
    revision: progressions[index].revision + 1,
  }
  let playerEntities = {
    ...state.playerEntities,
    progressions: Object.freeze(progressions),
    skillBooks: Object.freeze(skillBooks),
  }
  playerEntities = selectPlayerEntityPrimarySkill(
    playerEntities,
    playerId,
    testCase.primarySkillId,
  )
  Object.assign(state, {
    playerEntities,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
  })
}

function preparePrimaryStatusTarget(host, playerId, enemyBaseline) {
  restoreBoneyardEnemies(host, enemyBaseline)
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(playerIndex, -1)
  const playerPosition = state.playerEntities.locomotions[playerIndex].position
  const selected = state.world.enemies.actors.find(({ config, lifeState }) => (
    config.enemyToken === 'SKELETON' && lifeState === 'alive'
  )) ?? state.world.enemies.actors.find(({ config, lifeState }) => (
    config.enemyToken !== 'COFFIN' && lifeState === 'alive'
  ))
  assert.ok(selected, 'status-effect acceptance requires one mobile living enemy')
  const position = primaryStatusTargetPosition(
    state.world,
    playerPosition,
    selected.config.collisionRadius,
    selected.id,
  )
  const actors = state.world.enemies.actors.map((actor) => actor.id === selected.id
    ? {
        ...actor,
        currentHealth: actor.config.maximumHealth,
        nextMovementTick: state.tick + 100_000,
        nextTargetRefreshTick: state.tick,
        position,
        targetPlayerId: playerId,
      }
    : actor)
  Object.assign(state, {
    world: { ...state.world, enemies: { ...state.world.enemies, actors } },
  })
  return {
    authoredConfig: structuredClone(selected.config),
    id: selected.id,
    position,
    worldKey: `boneyard:${state.world.runId}`,
  }
}

function primaryStatusTargetPosition(world, playerPosition, bodyRadius, selectedId) {
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  for (const distance of [160, 140, 120, 100, 80]) {
    for (let index = 0; index < 32; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 16
      const candidate = {
        x: Math.fround(playerPosition.x + Math.cos(angle) * distance),
        y: Math.fround(playerPosition.y + Math.sin(angle) * distance),
      }
      if (firstBoneyardPathBlockProgress(
        playerPosition,
        candidate,
        world.bounds,
        collision,
        0,
      ) !== null) continue
      if (!canPlaceBoneyardBody(candidate, world.bounds, collision, bodyRadius)) continue
      if (world.enemies.actors.some((actor) => (
        actor.id !== selectedId
        && squaredDistance(actor.position, candidate) < (
          bodyRadius + actor.config.collisionRadius + 20
        ) ** 2
      ))) continue
      return candidate
    }
  }
  throw new Error('status-effect acceptance could not find a clear target path')
}

function enablePrimaryStatusTargetMovement(host, targetId) {
  const state = host.state()
  if (state.world.kind !== 'boneyard') return
  const actors = state.world.enemies.actors.map((actor) => actor.id === targetId
    ? { ...actor, nextMovementTick: state.tick }
    : actor)
  Object.assign(state, {
    world: { ...state.world, enemies: { ...state.world.enemies, actors } },
  })
}

async function primaryStatusTargetPointer(page, canvas, target) {
  await page.waitForFunction(({ id, x, y }) => {
    const enemy = document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.enemySamples.find((sample) => sample.id === id)
    return enemy !== undefined && Math.hypot(enemy.x - x, enemy.y - y) < 1
  }, { id: target.id, ...target.position }, { timeout: 5_000 })
  return canvas.evaluate((node, position) => {
    const bounds = node.getBoundingClientRect()
    const frame = node.__sdrBoneyardFrame
    return {
      x: bounds.left + bounds.width * 0.5
        + (position.x - frame.cameraX) * frame.cameraZoom,
      y: bounds.top + bounds.height * 0.5
        + (position.y - frame.cameraY) * frame.cameraZoom,
    }
  }, target.position)
}

async function pressPrimaryPointer(page, target) {
  await page.evaluate(({ x, y }) => {
    const surface = document.querySelector('.boneyard-world-renderer')
    if (!surface) throw new Error('Boneyard primary cast surface is unavailable')
    surface.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, target)
}

async function releasePrimaryPointer(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      cancelable: true,
    }))
  })
}

async function enterHub(page, baseUrl) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
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

function armQuickbar(host, playerId, baseSkillBook, skillIds, rank = 1) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  assert.notEqual(index, -1)
  const permanentRanks = [...baseSkillBook.permanentRanks]
  const effectiveRanks = [...baseSkillBook.effectiveRanks]
  const learnedSkillOrder = [...baseSkillBook.learnedSkillOrder]
  for (const skillId of skillIds) {
    if ((permanentRanks[skillId] ?? 0) === 0 && !learnedSkillOrder.includes(skillId)) {
      learnedSkillOrder.push(skillId)
    }
    permanentRanks[skillId] = rank
    effectiveRanks[skillId] = rank
  }
  const skillQuickbar = Object.freeze(Array.from(
    { length: 8 },
    (_, slot) => skillIds[slot] ?? null,
  ))
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...baseSkillBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: Object.freeze(learnedSkillOrder),
    permanentRanks: Object.freeze(permanentRanks),
    skillQuickbar,
  }
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: 1_000_000,
    currentMana: 10_000,
    deathEpoch: 0,
    deathTick: 0,
    lifeState: 'alive',
    maximumHealth: 1_000_000,
    maximumMana: 10_000,
    pendingOffer: null,
    revision: progressions[index].revision + 1,
  }
  const playerEntities = replacePlayerEconomy({
    ...state.playerEntities,
    progressions: Object.freeze(progressions),
    skillBooks: Object.freeze(skillBooks),
  }, playerId, state.playerEntities.economies[index])
  Object.assign(state, {
    playerEntities,
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
  })
}

function armMaximumSet(host, playerId, skillId, baseEquipment) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const equipment = structuredClone(baseEquipment)
  const recipes = skillId === 45 && singleGolemCapture
    ? []
    : MAXIMUM_SET_RECIPES.get(skillId) || []
  let ringSlot = 0
  for (const recipeIndex of recipes) {
    const item = createEquipmentInventoryItem(
      DOWSING_EQUIPMENT_RECIPES[recipeIndex],
      90_000 + recipeIndex,
    )
    switch (item.equipmentType) {
      case 'amulet': equipment.amulet = item; break
      case 'hat': equipment.hat = item; break
      case 'ring': equipment.rings[ringSlot++] = item; break
      case 'robe': equipment.robe = item; break
      case 'staff':
      case 'wand': equipment.weapon = item; break
      default: throw new Error(`maximum set recipe ${recipeIndex} is not equipment`)
    }
  }
  Object.assign(state, {
    playerEntities: replacePlayerEconomy(
      state.playerEntities,
      playerId,
      { ...state.playerEntities.economies[index], equipment },
    ),
  })
}

function playerEconomy(host, playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  return state.playerEntities.economies[index]
}

function playerProgression(host, playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  return state.playerEntities.progressions[index]
}

function maximumSetReceipt(state, playerId, skillId) {
  const owned = state.secondaryAbilities.actors.filter(({ ownerId }) => ownerId === playerId)
  switch (skillId) {
    case 11: {
      const parent = owned.find(({ kind }) => kind === 'leviathan')
      assert.equal(parent?.quantity, 5)
      assert.equal(owned.filter(({ kind }) => kind === 'leviathan-appendage').length, 5)
      return { appendages: 5, damage: parent.damage }
    }
    case 21: {
      const wave = owned.find(({ kind }) => kind === 'shockwave')
      if (wave) assert.equal(wave.variant, 1)
      assert.equal(state.secondaryAbilities.events.some(({ cameraMagnitude }) => (
        cameraMagnitude === 0.25
      )), true)
      return { cameraMagnitude: 0.25, maximumContactExplosion: true }
    }
    case 27: {
      const storm = owned.find(({ kind }) => kind === 'storm-cloud')
      assert.ok(storm?.freezeTicks >= 2_000)
      return { activeTicks: storm.freezeTicks, position: storm.position }
    }
    case 35: {
      const wave = owned.find(({ kind }) => kind === 'freeze-wave')
      if (wave) assert.equal(wave.variant, 1)
      const frostBurn = state.secondaryAbilities.targetEffects.find(({ frostBurnOwnerId }) => (
        frostBurnOwnerId === playerId
      ))
      assert.ok(wave?.variant === 1 || (frostBurn?.frostBurnTicks ?? 0) > 0)
      return {
        frostBurnEnabled: true,
        frostBurnTicks: frostBurn?.frostBurnTicks ?? null,
        freezeTicks: wave?.freezeTicks ?? frostBurn?.frozenTicks ?? null,
      }
    }
    case 45:
      assert.equal(owned.filter(({ kind }) => kind === 'golem').length, 2)
      return { expectedSummonCap: 2, summons: 2 }
    case 76: {
      const wave = owned.find(({ kind }) => kind === 'freeze-wave')
      const comet = owned.find(({ kind }) => kind === 'comet')
      if (wave) assert.equal(wave.variant, 1)
      else assert.equal(comet?.quantity, 1)
      return {
        frostBurnFreezeWave: wave?.variant === 1,
        freezeTicks: wave?.freezeTicks ?? comet?.freezeTicks,
        maximumStoredAtBirth: comet?.quantity === 1,
      }
    }
    default:
      return null
  }
}

function assertReportedPresentation(state, playerId, skillId, samples) {
  const actorSamples = samples.flatMap(({ actors }) => actors)
  switch (skillId) {
    case 11: {
      const parent = state.secondaryAbilities.actors.find(({ kind, ownerId }) => (
        kind === 'leviathan' && ownerId === playerId
      ))
      assert.ok(parent)
      const composite = actorSamples.filter(({ compositeOwnerId }) => (
        compositeOwnerId === parent.id
      ))
      assert.ok(composite.some(({ kind }) => kind === 'leviathan'))
      assert.equal(composite.filter(({ kind }) => kind === 'leviathan-appendage').length >= 5, true)
      const compositeFrames = samples.map(({ actors }) => actors.filter(({ compositeOwnerId }) => (
        compositeOwnerId === parent.id
      ))).filter(({ length }) => length > 0)
      assert.ok(compositeFrames.every((members) => (
        new Set(members.map(({ depth }) => depth)).size === 1
      )))
      return {
        compositeDepths: [...new Set(compositeFrames.map((members) => members[0].depth))],
        maximumCompositeMembers: Math.max(...compositeFrames.map(({ length }) => length)),
      }
    }
    case 21: {
      const maximumMagnitude = Math.max(...samples.map(({ cameraMagnitude }) => cameraMagnitude))
      assert.ok(maximumMagnitude > 0)
      return { maximumCameraMagnitude: maximumMagnitude }
    }
    case 27: {
      const storm = state.secondaryAbilities.actors.find(({ kind, ownerId }) => (
        kind === 'storm-cloud' && ownerId === playerId
      ))
      const rendered = actorSamples.find(({ id }) => id === storm?.id)
      assert.ok(storm && rendered)
      assert.equal(rendered.worldX, storm.position.x)
      assert.equal(rendered.worldY, storm.position.y)
      const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
      const playerPosition = state.playerEntities.locomotions[index].position
      assert.ok(Math.hypot(
        storm.position.x - playerPosition.x,
        storm.position.y - playerPosition.y,
      ) > 10)
      return { playerPosition, stormPosition: storm.position }
    }
    case 35:
      assert.ok(actorSamples.some(({ kind, primitiveCount }) => (
        kind === 'freeze-wave-visual' && primitiveCount >= 104
      )))
      return { ringPrimitiveCount: Math.max(...actorSamples
        .filter(({ kind }) => kind === 'freeze-wave-visual')
        .map(({ primitiveCount }) => primitiveCount)) }
    case 45: {
      assert.ok(actorSamples.some(({ kind, primitiveCount }) => (
        kind === 'golem' && primitiveCount >= 5
      )))
      const primitiveCounts = actorSamples
        .filter(({ kind }) => kind === 'golem')
        .map(({ primitiveCount }) => primitiveCount)
      assert.ok(Math.min(...primitiveCounts) <= 7)
      assert.ok(Math.max(...primitiveCounts) >= 18)
      return {
        assemblyPrimitiveCounts: [...new Set(primitiveCounts)].sort((a, b) => a - b),
        maximumGolemPrimitives: Math.max(...primitiveCounts),
      }
    }
    case 72: {
      const rain = state.secondaryAbilities.actors.find(({ kind, ownerId }) => (
        kind === 'acid-rain' && ownerId === playerId
      ))
      const rendered = actorSamples.filter(({ id }) => id === rain?.id)
      assert.ok(rain && rendered.length > 0)
      const withResidue = rendered.filter(({ underlayPrimitiveCount }) => (
        underlayPrimitiveCount === 1
      ))
      assert.ok(withResidue.length > 0)
      assert.ok(rendered.every(({ sortBias }) => sortBias === 0))
      assert.ok(rendered.every(({ worldY }) => worldY === rain.position.y + 350))
      assert.ok(withResidue.every(({ underlayDepth }) => underlayDepth === 0.5))
      assert.ok(withResidue.every(({ depth, underlayDepth }) => depth > underlayDepth))
      assert.ok(rendered.every(({ mainDrawMembers, mainDrawOffsetsY }) => (
        mainDrawMembers.join('|') === [
          'BadGuys:78:normal',
          'BadGuys:78:add',
          'BadGuys:10:add',
        ].join('|')
          && mainDrawOffsetsY.length === 3
          && mainDrawOffsetsY[0] === -175
          && mainDrawOffsetsY[1] === -175
          && mainDrawOffsetsY[2] <= -175
          && mainDrawOffsetsY[2] >= -225
      )))
      assert.ok(withResidue.every(({ underlayDrawMembers }) => (
        underlayDrawMembers.join('|') === 'DeadHawg:4:normal'
      )))
      assert.ok(samples.some(({ kinds }) => kinds.includes('acid-drop')))
      assert.ok(samples.some(({ kinds }) => kinds.includes('acid-splash')))
      return {
        cloudLocalYRange: [
          Math.min(...rendered.flatMap(({ mainDrawOffsetsY }) => mainDrawOffsetsY)),
          Math.max(...rendered.flatMap(({ mainDrawOffsetsY }) => mainDrawOffsetsY)),
        ],
        cloudProxyWorldY: rain.position.y + 350,
        cloudSpriteMembers: rendered[0].mainDrawMembers,
        groundResidueDepth: 0.5,
        groundResidueMembers: withResidue[0].underlayDrawMembers,
        groundResiduePrimitives: 1,
      }
    }
    default:
      return null
  }
}

async function openBoneyardCombat(page, host, playerId) {
  if (host.state().world.kind !== 'boneyard') throw new Error('expected Boneyard host world')
  if (host.state().world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')) return
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Boneyard combat proof requires the Solomon opening encounter')
  setHostPlayerPosition(host, index, solomon)
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard' && world.encounter?.phase === 'speaking'
  }, 'Solomon did not enter the authentic speaking phase', 10_000)
  const afterApproach = host.state()
  assert.equal(afterApproach.world.kind, 'boneyard')
  setHostPlayerPosition(host, index, { x: solomon.x, y: solomon.y + 250 })
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard' && world.enemies.actors.some(({ lifeState }) => (
      lifeState === 'alive'
    ))
  }, 'Solomon opening did not release a live combat wave', 30_000)
  const combatState = host.state()
  assert.equal(combatState.world.kind, 'boneyard')
  const combatBounds = combatState.world.arenaTransition?.combatBounds
  assert.ok(combatBounds, 'Boneyard combat proof requires sealed arena bounds')
  setHostPlayerPosition(host, index, {
    x: combatBounds.x + combatBounds.w * 0.5,
    y: combatBounds.y + combatBounds.h * 0.5,
  })
  await page.waitForTimeout(150)
}

function setHostPlayerPosition(host, index, position) {
  const state = host.state()
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = { ...locomotions[index], position: { ...position }, velocity: { x: 0, y: 0 } }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      locomotions: Object.freeze(locomotions),
    },
  })
}

function restoreBoneyardEnemies(host, baseline) {
  const state = host.state()
  if (state.world.kind !== 'boneyard') return
  const current = state.world.enemies
  const enemies = structuredClone(baseline)
  enemies.lastStepTick = state.tick
  for (const counter of [
    'nextActorId',
    'nextDeathEpoch',
    'nextDeathEffectId',
    'nextEventId',
    'nextMageLightningPulseId',
    'nextProjectileEffectId',
    'nextProjectileId',
    'nextSyntheticSpawnIntentId',
  ]) {
    enemies[counter] = Math.max(enemies[counter], current[counter])
  }
  enemies.actors = enemies.actors.map((actor) => ({
    ...actor,
    nextMovementTick: state.tick + 1_000,
    nextTargetRefreshTick: state.tick + 1_000,
  }))
  Object.assign(state, { world: { ...state.world, enemies, enemyEvents: [] } })
}

function stabilizeBoneyardCooldownEnemies(host) {
  const state = host.state()
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard host world')
  const enemies = {
    ...state.world.enemies,
    actors: state.world.enemies.actors.map((actor) => ({
      ...actor,
      config: { ...actor.config, maximumHealth: 1_000_000_000 },
      currentHealth: 1_000_000_000,
      nextMovementTick: state.tick + 1_000_000,
      nextTargetRefreshTick: state.tick + 1_000_000,
    })),
  }
  Object.assign(state, {
    world: {
      ...state.world,
      enemies,
      enemyEvents: [],
    },
  })
}

async function abilityCastTarget(canvas, host, playerId, skillId, scene) {
  const fallback = await canvas.evaluate((node) => {
    const bounds = node.getBoundingClientRect()
    return {
      x: bounds.left + bounds.width * 0.5,
      y: bounds.top + bounds.height * 0.4,
    }
  })
  if (cooldownOnly || scene !== 'boneyard' || !COMBAT_PROOF_SKILLS.has(skillId)) {
    return { combatBaseline: null, pointer: fallback }
  }
  await waitUntil(() => {
    const state = host.state()
    if (state.world.kind !== 'boneyard') return false
    return state.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
  }, 'the Boneyard produced no live enemy for secondary combat proof', 10_000)
  let state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const playerPosition = state.playerEntities.locomotions[index].position
  let enemy = [...state.world.enemies.actors]
    .filter(({ lifeState }) => lifeState === 'alive')
    .sort((left, right) => (
      squaredDistance(left.position, playerPosition)
        - squaredDistance(right.position, playerPosition)
      || left.id - right.id
    ))[0]
  assert.ok(enemy)
  const position = comparisonCapture && skillId === 72
    ? { x: playerPosition.x + 200, y: playerPosition.y }
    : {
        x: playerPosition.x,
        y: playerPosition.y + (skillId === 27 ? 100 : -50),
      }
  const enemies = {
    ...state.world.enemies,
    actors: state.world.enemies.actors.map((actor) => {
      if (actor.id === enemy.id) {
        return { ...actor, nextMovementTick: state.tick + 100_000, position }
      }
      if (skillId !== 72 || actor.lifeState !== 'alive') return actor
      return {
        ...actor,
        nextMovementTick: state.tick + 100_000,
        position: {
          x: position.x + 1_000 + actor.id,
          y: position.y + 1_000,
        },
      }
    }),
  }
  Object.assign(state, { world: { ...state.world, enemies } })
  await new Promise((resolve) => setTimeout(resolve, 30))
  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  enemy = state.world.enemies.actors.find(({ id }) => id === enemy.id)
  assert.ok(enemy)
  const projection = await canvas.evaluate((node) => {
    const bounds = node.getBoundingClientRect()
    const frame = node.__sdrBoneyardFrame
    return {
      bounds: {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
      },
      frame: {
        cameraX: frame.cameraX,
        cameraY: frame.cameraY,
        cameraZoom: frame.cameraZoom,
        playerScreenX: frame.playerScreenX,
        playerScreenY: frame.playerScreenY,
      },
    }
  })
  const pointer = {
    x: projection.bounds.left + (projection.bounds.right - projection.bounds.left) * 0.5
      + (enemy.position.x - projection.frame.cameraX) * projection.frame.cameraZoom,
    y: projection.bounds.top + (projection.bounds.bottom - projection.bounds.top) * 0.5
      + (enemy.position.y - projection.frame.cameraY) * projection.frame.cameraZoom,
  }
  const playerPointer = {
    x: projection.bounds.left + projection.frame.playerScreenX,
    y: projection.bounds.top + projection.frame.playerScreenY,
  }
  const visible = pointer.x >= projection.bounds.left
    && pointer.x <= projection.bounds.right
    && pointer.y >= projection.bounds.top
    && pointer.y <= projection.bounds.bottom
  return {
    combatBaseline: {
      enemyId: enemy.id,
      health: enemy.currentHealth,
      position: { ...enemy.position },
      worldKey: `boneyard:${state.world.runId}`,
    },
    pointer: skillId === 11 ? playerPointer : visible ? pointer : fallback,
  }
}

async function collectCombatProof(host, playerId, skillId, baseline, scene) {
  if (scene !== 'boneyard' || !baseline || !COMBAT_PROOF_SKILLS.has(skillId)) return null
  let receipt = null
  try {
    await waitUntil(() => {
      const state = host.state()
      if (state.world.kind !== 'boneyard') return false
      const enemy = state.world.enemies.actors.find(({ id }) => id === baseline.enemyId)
      const effect = state.secondaryAbilities.targetEffects.find(({ targetId, worldKey }) => (
        targetId === baseline.enemyId && worldKey === baseline.worldKey
      ))
      const health = enemy?.currentHealth ?? 0
      const damaged = enemy === undefined || health < baseline.health
      const frozen = (effect?.frozenTicks ?? 0) > 0
      const frostBurn = (effect?.frostBurnTicks ?? 0) > 0
      const succeeded = skillId === 35 ? frozen && frostBurn : damaged
      if (!succeeded) return false
      receipt = {
        damaged,
        enemyId: baseline.enemyId,
        finalHealth: health,
        frostBurnTicks: effect?.frostBurnTicks ?? 0,
        frozenTicks: effect?.frozenTicks ?? 0,
        initialHealth: baseline.health,
        ownerId: playerId,
      }
      return true
    }, `secondary ${skillId} produced no authoritative enemy damage/status`, 20_000)
  } catch (error) {
    const state = host.state()
    process.stderr.write(`${JSON.stringify({
      combatFailure: {
        baseline,
        effects: state.secondaryAbilities.targetEffects,
        enemy: state.world.kind === 'boneyard'
          ? state.world.enemies.actors.find(({ id }) => id === baseline.enemyId) ?? null
          : null,
        playerPosition: state.playerEntities.locomotions[
          state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
        ]?.position,
        waveActors: state.secondaryAbilities.actors.filter(({ skillId: id }) => id === skillId),
      },
    }, null, 2)}\n`)
    throw error
  }
  if (skillId === 72) {
    const state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    const rain = state.secondaryAbilities.actors.find(({ kind, ownerId }) => (
      kind === 'acid-rain' && ownerId === playerId
    ))
    const enemy = state.world.enemies.actors.find(({ id }) => id === baseline.enemyId)
    assert.ok(rain && enemy && receipt)
    const edgeHealth = enemy.currentHealth
    const edgeAge = rain.ageTicks
    const edgePosition = { x: rain.position.x + 200, y: rain.position.y }
    const enemies = {
      ...state.world.enemies,
      actors: state.world.enemies.actors.map((actor) => actor.id === enemy.id
        ? {
            ...actor,
            nextMovementTick: state.tick + 100_000,
            position: edgePosition,
          }
        : actor),
    }
    Object.assign(state, { world: { ...state.world, enemies } })
    await waitUntil(() => {
      const current = host.state().secondaryAbilities.actors.find(({ id }) => id === rain.id)
      return (current?.ageTicks ?? 0) >= edgeAge + 30
    }, 'Acid Rain did not advance through its next exact-area pulse', 2_000)
    const edgeEnemy = host.state().world.kind === 'boneyard'
      ? host.state().world.enemies.actors.find(({ id }) => id === enemy.id)
      : null
    assert.equal(edgeEnemy?.currentHealth, edgeHealth)
    receipt = {
      ...receipt,
      attackArea: {
        bodyRadius: enemy.config.collisionRadius,
        center: { ...rain.position },
        exactEdgeDistance: 200,
        exactEdgeHealthAfter: edgeEnemy?.currentHealth,
        exactEdgeHealthBefore: edgeHealth,
        exactEdgePosition: edgePosition,
      },
    }
  }
  return receipt
}

function positionCombatTargetForAbility(host, skillId, baseline) {
  if (skillId !== 11 || baseline === null) return
  const state = host.state()
  if (state.world.kind !== 'boneyard') return
  const appendage = state.secondaryAbilities.actors.find(({ kind }) => (
    kind === 'leviathan-appendage'
  ))
  const parentId = appendage?.hitTargetIds[0]
  const parent = state.secondaryAbilities.actors.find(({ id }) => id === parentId)
  if (!appendage || !parent) return
  const heading = appendage.rotationRadians
  const queryOrigin = {
    x: parent.position.x + appendage.endpoint.x,
    y: parent.position.y + appendage.endpoint.y,
  }
  const position = {
    x: queryOrigin.x + Math.sin(heading) * 50,
    y: queryOrigin.y - Math.cos(heading) * 50,
  }
  const enemies = {
    ...state.world.enemies,
    actors: state.world.enemies.actors.map((actor) => actor.id === baseline.enemyId
      ? { ...actor, nextMovementTick: state.tick + 1_000, position }
      : actor),
  }
  Object.assign(state, { world: { ...state.world, enemies } })
  baseline.position = { ...position }
}

function squaredDistance(left, right) {
  const x = left.x - right.x
  const y = left.y - right.y
  return x * x + y * y
}

async function resetSecondaryWorld(host) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = host.state()
    Object.assign(state, {
      secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    if (host.state().secondaryAbilities.actors.length === 0) return
  }
  throw new Error('secondary world reset did not win the host tick boundary')
}

async function captureBeltReceipt(page) {
  const slots = await page.locator('.hub-hud-quickbar-slot').evaluateAll((nodes) => (
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect()
      const icon = node.querySelector('.hub-hud-quickbar-skill-icon')
      const backing = node.querySelector('.hub-hud-quickbar-key-backing')
      const mouse = node.querySelector('.hub-hud-quickbar-input-mouse')
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
    document.querySelector('.hub-hud-quickbar-slot[data-slot="0"]')
      ?.getAttribute('aria-label')?.startsWith(`${expectedName}, right mouse button`)
  ), name, { timeout: 10_000 })
}

async function castSecondaryPointer(page, target) {
  await page.evaluate(({ x, y }) => {
    const surface = document.querySelector('.boneyard-world-renderer, .hub-world-renderer')
    if (!surface) throw new Error('secondary cast surface is unavailable')
    surface.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, target)
  await page.waitForTimeout(35)
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, target)
}

async function castPrimaryPointer(page, target) {
  await page.evaluate(({ x, y }) => {
    const surface = document.querySelector('.boneyard-world-renderer, .hub-world-renderer')
    if (!surface) throw new Error('primary cast surface is unavailable')
    surface.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, target)
  await page.waitForTimeout(90)
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, target)
}

async function waitForPlayerPresentation(page, skillId, materialTintBeforeCast) {
  const expectedMaterialTint = skillId === 46
    ? halfMaterialTint(materialTintBeforeCast)
    : null
  await page.waitForFunction(({ id, tint }) => {
    const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
    const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
    if (!frame) return false
    if (id === 46) return frame.playerMaterialTint === tint
    return frame.playerMagicShieldVisible && frame.playerMagicShieldScale >= 1.5
  }, { id: skillId, tint: expectedMaterialTint }, { timeout: 10_000 })
  return page.evaluate(({ before, expected }) => {
    const canvas = document.querySelector('.hub-world-canvas, .boneyard-world-canvas')
    const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
    return {
      materialTint: frame?.playerMaterialTint ?? null,
      materialTintBeforeCast: before,
      materialTintExpected: expected,
      magicShieldScale: frame?.playerMagicShieldScale ?? null,
      magicShieldVisible: frame?.playerMagicShieldVisible ?? null,
    }
  }, { before: materialTintBeforeCast, expected: expectedMaterialTint })
}

function halfMaterialTint(tint) {
  assert.ok(Number.isInteger(tint) && tint >= 0 && tint <= 0xffffff)
  const half = (shift) => Math.round(((tint >> shift) & 0xff) * 0.5)
  return (half(16) << 16) | (half(8) << 8) | half(0)
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
