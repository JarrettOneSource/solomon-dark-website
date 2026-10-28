import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { startElementHub, enterBoneyard } from '../game-smoke-navigation.mjs'
import { GameWelcomeReceiver } from '../../src/game/protocol/game-welcome-transfer.ts'
import { EntityReplicationReconstructor } from '../../src/game/protocol/entity-replication.ts'

// Adapters translate controls and accepted snapshots. They never send protocol
// commands or assign game state; the running client owns every input and ACK.
export async function createAdapter({ page, client, helpers, ui, errors, output }) {
  const require = createRequire(import.meta.url)
  const { startNewGame } = require(resolve(helpers, 'menu-journey.cjs'))
  const { createNativeMessageReader } = require(resolve(helpers, 'native-wire.cjs'))
  const { prepareBoneyardNavigation, walkSolomonEntrance } = require(resolve(helpers, 'solomon-entrance.cjs'))
  let snapshot, playerId, host, loadedBoneyard, navigation, pixiPause
  let admissions = 0
  const pickupEvents = new Set()
  const bounds = value => ({ x: value.x, y: value.y, width: value.w, height: value.h })
  const title = async () => {
    if (client === 'rust') await ui.surface(page, 'title', { timeout: 180_000 })
    else await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 180_000 })
  }
  const rustWorld = () => client === 'rust' ? snapshot?.boneyard : snapshot?.world?.kind === 'boneyard' ? {
    source_sha256: loadedBoneyard?.sourceSha256,
    geometry_sha256: loadedBoneyard?.geometrySha256,
    run_id: snapshot.world.runId,
    gate_leaves: snapshot.world.gateLeaves.map(leaf => ({ ...leaf, fence_eid: leaf.fenceEid })),
    arena_transition: snapshot.world.arenaTransition ? {
      full_bounds: bounds(snapshot.world.arenaTransition.fullBounds),
      combat_bounds: bounds(snapshot.world.arenaTransition.combatBounds),
      camera_bounds: bounds(snapshot.world.arenaTransition.cameraBounds),
      entry_side: snapshot.world.arenaTransition.entrySide === 'south' ? 'South' : 'North',
    } : null,
    encounter: snapshot.world.encounter ? {
      ...snapshot.world.encounter,
      phase: snapshot.world.encounter.phase.replace(/(^|-)([a-z])/g, (_, _separator, letter) => letter.toUpperCase()),
      run_event_id: snapshot.world.encounter.runEventId,
    } : null,
  } : null
  const navigationSnapshot = () => client === 'rust' ? snapshot : {
    ticks: snapshot.tick, boneyard: rustWorld(), participants: {
      [playerId]: { wizard: { position: snapshot.players[playerId].position },
        player: { combat: { life_state: snapshot.players[playerId].progression.lifeState === 'alive' ? 'Alive' : 'Dead' } } },
    },
  }
  page.on('websocket', socket => {
    const read = createNativeMessageReader()
    const welcome = new GameWelcomeReceiver()
    const reconstructor = new EntityReplicationReconstructor()
    socket.on('close', () => welcome.close())
    socket.on('framereceived', ({ payload }) => {
      try {
        if (client === 'rust') {
          const message = read(JSON.parse(payload.toString()))
          if (message?.type === 'welcome') { playerId = message.credentials.player_id; admissions++ }
          if (message?.type === 'welcome' || message?.type === 'snapshot') {
            snapshot = message.frame.snapshot
            host = message.frame.host
          }
        } else {
          const message = welcome.receivePayload(payload.toString(), () => {})
          if (message?.type === 'server-welcome') {
            admissions++
            playerId = message.playerId
            snapshot = message.snapshot
            reconstructor.reset(snapshot, message.snapshotSequence)
            pixiPause = message.gameplayPause
          } else if (message?.type === 'server-snapshot') {
            snapshot = reconstructor.apply(message.frame, message.sequence)
          } else if (message?.type === 'server-boneyard-loaded') loadedBoneyard = message.boneyard
          else if (message?.type === 'server-gameplay-pause') pixiPause = message.pause
        }
        const events = client === 'rust' ? snapshot?.boneyard?.loot_events : snapshot?.world?.lootEvents
        for (const event of events || []) {
          const pickup = client === 'rust' ? event.event_type === 'LootPickup' && event.player_id === playerId
            : event.type === 'loot-pickup' && event.playerId === playerId
          if (pickup) pickupEvents.add(`${rustWorld()?.run_id}:${event.event_id ?? event.eventId}`)
        }
      } catch (error) { errors.push({ observer: error.message }) }
    })
  })
  const pixiDialog = () => page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES", exact: true })
  const shortcuts = new Set(['Hagatha', 'Fomentius', 'Luthacus', 'Shlorio', 'Provokatus', 'Enter the Boneyard'])
  return {
    async close() { if (navigation) assert.equal(await navigation.close(), 0) },
    async captureReady() {
      if (client === 'rust') {
        await ui.nextFrame(page)
        if ((await ui.readUi(page)).inputScope === 'inventory') {
          await ui.actionable(page, 'panel:close')
          // PlayerPanels reveals for forty 10 ms presentation ticks, while its
          // controls become actionable earlier. Capture the completed artwork.
          await page.waitForTimeout(400)
          await ui.nextFrame(page)
        }
        return
      }
      await page.locator('.main-menu-screen-fade-idle').waitFor({ state: 'attached' })
      if (await page.locator('.title-menu-renderer').isVisible()) {
        await page.locator('.title-menu-renderer canvas[data-screen]').waitFor()
      }
      if (await page.locator('.hub-native-ui-stage').isVisible()) {
        await page.locator('.hub-native-ui-renderer canvas[data-native-reveal-progress="1"]').waitFor()
      }
    },
    async start(element) {
      if (client === 'rust') {
        await ui.ready(page)
        await startNewGame(page, { element: element.toLowerCase(), name: null })
      } else await startElementHub(page, element)
    },
    async enterBoneyard() {
      if (client === 'rust') {
        await ui.click(page, 'hud:map')
        await ui.waitForUi(page, state => state.surface === 'hidden' && ui.findWidget(state, 'hud:health'), 'Boneyard HUD', { timeout: 120_000 })
      } else await enterBoneyard(page)
      const deadline = Date.now() + 120_000
      while ((!rustWorld()?.run_id || client === 'pixi' && !loadedBoneyard) && Date.now() < deadline) await page.waitForTimeout(25)
      assert.ok(rustWorld()?.run_id, 'the actual Boneyard was admitted')
      if (client === 'rust') {
        await ui.waitForUi(page, state => !host?.loading_run_id && !host?.resume_grace
          && state.surface === 'hidden' && !state.inputScope
          && !ui.findWidget(state, 'match-loading:label') && !ui.findWidget(state, 'shared:resume'),
        'accepted Boneyard input after resume grace', { timeout: 120_000 })
      }
      navigation = await prepareBoneyardNavigation(rustWorld())
    },
    async approachSolomon() {
      assert.ok(navigation, 'enter a Boneyard before navigation')
      await walkSolomonEntrance(page, { snapshot: navigationSnapshot, playerId: () => playerId, output, plan: navigation })
    },
    async walkToward(x, y, milliseconds) {
      assert.ok(navigation, 'enter a Boneyard before navigation')
      const at = navigationSnapshot().participants[playerId].wizard.position
      const bounds = rustWorld().arena_transition?.combat_bounds || navigation.scene.bounds
      const route = await navigation.findRoute(at, { x, y }, bounds)
      const target = route?.[1]
      if (!target) return false
      const direction = await navigation.direction(at, target, bounds)
      const keys = []
      if (Math.abs(direction.x) > Math.abs(direction.y) * Math.tan(Math.PI / 8)) keys.push(direction.x < 0 ? 'KeyA' : 'KeyD')
      if (Math.abs(direction.y) > Math.abs(direction.x) * Math.tan(Math.PI / 8)) keys.push(direction.y < 0 ? 'KeyW' : 'KeyS')
      for (const key of keys) await page.keyboard.down(key)
      try { await page.waitForTimeout(milliseconds) } finally { for (const key of keys) await page.keyboard.up(key) }
      return true
    },
    async castAt(x, y, milliseconds) {
      assert.ok(navigation, 'enter a Boneyard before casting')
      let point
      if (client === 'rust') point = await navigation.screenPoint({ x, y },
        snapshot.participants[playerId].wizard.position, rustWorld().arena_transition.camera_bounds, { x: 1600, y: 900 })
      else point = await page.locator('.boneyard-world-canvas').evaluate((canvas, target) => {
        const frame = canvas.__sdrBoneyardFrame, bounds = canvas.getBoundingClientRect()
        return { x: bounds.x + bounds.width / 2 + (target.x - frame.cameraX) * frame.cameraZoom * bounds.width / 1600,
          y: bounds.y + bounds.height / 2 + (target.y - frame.cameraY) * frame.cameraZoom * bounds.height / 900 }
      }, { x, y })
      if (point.x < 30 || point.x > 1470 || point.y < 80 || point.y > 760) return false
      await page.mouse.move(point.x, point.y)
      await page.mouse.down()
      try { await page.waitForTimeout(milliseconds) } finally { await page.mouse.up() }
      return true
    },
    async reloadAndContinue() {
      const previousAdmissions = admissions, runId = rustWorld()?.run_id
      await ui.observeDocumentReplacement(page, () => page.reload({ waitUntil: 'domcontentloaded' }))
      await title()
      if (client === 'rust') {
        await ui.click(page, 'play'); await ui.click(page, 'continue'); await ui.surface(page, 'hidden')
        await ui.widget(page, 'hud:health')
      } else {
        await page.getByRole('button', { name: 'Play', exact: true }).click()
        await page.getByRole('button', { name: 'Last game', exact: true }).click()
        await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 120_000 })
        await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 120_000 })
      }
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline && (admissions <= previousAdmissions || rustWorld()?.run_id !== runId
        || client === 'rust' && (host?.loading_run_id || host?.resume_grace || host?.pause))) await page.waitForTimeout(25)
      assert.ok(admissions > previousAdmissions, 'Continue receives a fresh authority welcome')
      assert.equal(rustWorld()?.run_id, runId, 'Continue admits the saved Boneyard')
      if (client === 'rust') await ui.waitForUi(page, state => !host?.loading_run_id && !host?.resume_grace
        && !host?.pause && state.surface === 'hidden' && !state.inputScope
        && !ui.findWidget(state, 'match-loading:label') && !ui.findWidget(state, 'shared:resume'),
      'accepted continued gameplay input', { timeout: 120_000 })
    },
    async fill(name, value) {
      assert.equal(name, 'gold', 'unknown text control')
      if (client === 'rust') await ui.fill(page, 'cheats/gold', value)
      else await page.getByRole('dialog', { name: 'Cheat menu' }).getByLabel('GOLD', { exact: true }).fill(value)
    },
    async click(name) {
      if (shortcuts.has(name)) {
        if (client === 'rust') await ui.click(page, (await ui.byLabel(page, name, { role: 'button' })).id)
        else await page.getByRole('button', {
          name: name === 'Enter the Boneyard' ? name : `Open ${name} interaction`, exact: true,
        }).click()
        return
      }
      if (name === 'set-gold') {
        if (client === 'rust') await ui.click(page, 'cheats/submit:gold')
        else await page.getByRole('button', { name: 'SET GOLD', exact: true }).click()
      } else if (name === 'tonic') {
        if (client === 'rust') await ui.click(page, 'panel:hagatha:27')
        else await pixiDialog().getByRole('button', { name: /^Buy TONIC for \d+ gold$/ }).click()
      } else if (name === 'life-charm') {
        if (client === 'rust') await ui.click(page, 'panel:hagatha:0')
        else await pixiDialog().getByRole('button', { name: /^Buy LIFE CHARM for \d+ gold$/ }).click()
      } else if (name === 'remove-life-charm') {
        if (client === 'rust') await ui.click(page, (await ui.byLabel(page, 'Remove LIFE CHARM', { role: 'button' })).id)
        else await pixiDialog().getByRole('button', { name: 'Remove LIFE CHARM', exact: true }).click()
      } else if (name === 'close-panel') {
        if (client === 'rust') { await ui.click(page, 'panel:close'); await ui.noWidget(page, 'panel:service') }
        else { await pixiDialog().getByRole('button', { name: 'Done', exact: true }).click(); await pixiDialog().waitFor({ state: 'hidden' }) }
      } else if (name === 'leave') {
        if (client === 'rust') { await ui.click(page, 'leave'); await ui.surface(page, 'title') }
        else { await page.getByRole('button', { name: 'LEAVE GAME', exact: true }).click(); await page.getByRole('button', { name: 'Play', exact: true }).waitFor() }
      } else if (name === 'first-skill') {
        if (client === 'rust') await ui.click(page, 'picker:choice:0')
        else await page.locator('.skill-picker-action[data-choice-index="0"]').click()
      } else throw new Error(`Unknown control: ${name}`)
    },
    async observe() {
      const player = client === 'rust' ? snapshot?.participants[playerId]?.player : snapshot?.players[playerId]
      const economy = player?.economy
      const world = client === 'rust' ? snapshot?.boneyard : snapshot?.world
      const state = client === 'rust' ? {
        tick: snapshot?.ticks, playerId, gold: economy?.gold,
        tonics: economy?.tonic_purchases, charmCapacity: economy?.charm_capacity,
        perks: economy?.owned_perk_selectors,
        runId: snapshot?.boneyard?.run_id ?? null,
        loading: Boolean(host?.loading_run_id || host?.resume_grace),
      } : {
        tick: snapshot?.tick, playerId, gold: economy?.gold,
        tonics: economy?.tonicPurchases, charmCapacity: economy?.charmCapacity,
        perks: economy?.ownedPerkSelectors,
        runId: snapshot?.world?.kind === 'boneyard' ? snapshot.world.runId : null,
      }
      state.hasLifeCharm = Boolean(state.perks?.includes(0))
      state.paused = Boolean(client === 'rust' ? host?.pause : pixiPause)
      state.health = client === 'rust' ? player?.combat.current_health : player?.progression.currentHealth
      state.mana = client === 'rust' ? player?.combat.current_mana : player?.progression.currentMana
      state.experience = player?.progression.experience
      state.level = player?.progression.level
      state.pendingOffer = Boolean(client === 'rust' ? player?.progression.pending_offer : player?.progression.pendingOffer)
      state.kills = client === 'rust' ? snapshot?.participants[playerId]?.score.monsters_killed : world?.hallOfFameRuns?.[playerId]?.monstersKilled
      state.pickups = pickupEvents.size
      state.combatBounds = rustWorld()?.arena_transition?.combat_bounds
      state.castSequence = client === 'rust' ? snapshot?.participants[playerId]?.wizard.primary_cast.cast_sequence : player?.primaryCast.castSequence
      state.enemies = ((client === 'rust' ? world?.enemies?.actors : world?.enemies) || []).filter(actor => client === 'rust'
        ? actor.life_state === 'Alive' && actor.current_health > 0 : actor.currentHealth > 0)
        .map(actor => ({ id: actor.id, ...actor.position }))
      state.loot = ((client === 'rust' ? world?.loot?.actors : world?.loot) || []).filter(actor => client === 'rust'
        ? ['Gold', 'Orb'].includes(actor.kind) && actor.activation_delay_ticks < 1
        : ['gold', 'orb'].includes(actor.kind) && actor.activationDelayTicks < 1)
        .map(actor => ({ id: actor.id, ...actor.position }))
      if (client === 'rust') {
        state.ui = await ui.readUi(page)
        state.tonicControls = state.ui.widgets.filter(widget => widget.label === 'Inspect TONIC').length
        state.position = await page.evaluate(() => window.wasmBindings
          ? Array.from(window.wasmBindings.wizard_state()).slice(0, 2) : null)
      } else {
        state.tonicControls = await page.locator('[data-owned-hagatha-selector="27"]').count()
        state.position = await page.evaluate(() => {
          const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
            || document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
          return frame ? [frame.playerX, frame.playerY] : null
        })
        state.dialogs = await page.getByRole('dialog').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')))
      }
      return state
    },
  }
}
