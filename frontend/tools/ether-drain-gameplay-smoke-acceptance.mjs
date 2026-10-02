import assert from 'node:assert/strict'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { canPlaceBoneyardBody, withBoneyardGateCollision } from '../src/game/core-server/boneyard-collision.ts'
import { spawnBoneyardLootSpecs } from '../src/game/core-server/boneyard-loot-store.ts'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { boneyardEnemyCollisionRadius } from '../src/game/core-server/enemies/model.ts'
import { boneyardEnemyBodies, boneyardLanternBodies } from '../src/game/core-server/boneyard-world-placement.ts'
import { addPlayerCharacter, getPlayerCharacter, getPlayerProgression,
  stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { grantPlayerEntitySkillRanks, replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'

// The existing runner owns the compiled client, live host, audio/error probes and
// cleanup. Each fixture is explicit; these are not captured retail inputs.
export async function acceptEtherDrainGameplay({ page, canvas, host, playerId, baseSkillBook, armQuickbar,
  castSecondaryPointer, stabilizeBoneyardCooldownEnemies, screenshotRoot }) {
  const cases = []
  const remainingOnly = process.env.SDR_ETHER_DRAIN_GAMEPLAY_REMAINING === '1'
  const lane = clearLane(host.state().world)
  const config = { page, canvas, host, playerId, baseSkillBook, armQuickbar, castSecondaryPointer,
    stabilizeBoneyardCooldownEnemies, lane }
  if (!remainingOnly) {
    for (const distance of [1, 350]) {
      const field = await fieldFixture(config, [67])
      move(host, playerId, { x: field.position.x + lane.direction.x * distance, y: field.position.y + lane.direction.y * distance })
      const start = host.state().tick
      await page.keyboard.down(lane.direction.key)
      let player
      try {
        await waitUntil(() => host.state().tick >= start + 400, 'Rush fixture did not advance 400 ticks')
        player = structuredClone(getPlayerCharacter(host.state(), playerId))
      } finally { await page.keyboard.up(lane.direction.key) }
      const depth = Math.hypot(player.position.x - field.position.x, player.position.y - field.position.y)
      console.log(JSON.stringify({ rushFixture: { distance, depth, position: player.position, velocity: player.velocity, fieldPosition: field.position, lane } }))
      assert.ok(distance === 1 ? depth < field.radius : depth > field.radius, `Rush distance${distance} reached${depth}`)
      cases.push({ kind: 'rush', distance, depth, velocity: player.velocity, fieldId: field.id })
    }
    const drive = cases.slice(0, 2).map(({ velocity }) => {
      assert.equal(velocity.x * lane.direction.y - velocity.y * lane.direction.x, 0)
      return velocity.x * lane.direction.x + velocity.y * lane.direction.y
    })
    assert.ok(drive.every(value => value > 98))
    assert.ok(Math.abs(drive[0] - drive[1]) < .01, 'both real held-input samples retain the same Rush drive')

    const tk = []
    for (const rank of [0, 1]) {
      await fieldFixture(config, rank ? [66] : [])
      move(host, playerId, lane.center)
      const point = { x: Math.fround(lane.center.x + lane.direction.x * 250), y: Math.fround(lane.center.y + lane.direction.y * 250) }
      const managers = createNativeWorldManagerOrder(host.state().worldManagerOrder)
      const spawned = spawnBoneyardLootSpecs({ ...host.state().world.loot, actors: [] }, [{ activationDelayTicks: 0,
        id: 1, kind: 'orb', nativeTypeId: 2011, orbKind: 'mana', value: .5, phase: 0, position: point, source: 'script' }],
      host.state().tick, managers.register).store
      Object.assign(host.state(), { world: { ...host.state().world, loot: spawned }, worldManagerOrder: managers.state(),
        secondaryAbilities: { ...host.state().secondaryAbilities, actors: [] } })
      const start = host.state().tick
      await waitUntil(() => host.state().tick >= start + 10, 'Telekinesis control did not advance')
      const orb = host.state().world.loot.actors[0]
      assert.ok(orb)
      tk.push({ rank, distance: Math.hypot(orb.position.x - lane.center.x, orb.position.y - lane.center.y) })
    }
    assert.ok(tk[1].distance < tk[0].distance - 5)
    cases.push({ kind: 'telekinesis', controls: tk })
    console.log(JSON.stringify({ telekinesisPassed: tk }))
  }

  const captures = []
  const captureFamilies = remainingOnly ? [['DEMON', true], ['IMP', false], ['SPIDER', true], ['WRAITH', false]]
    : [['SKELETON', true], ['SKELETONARCHER', true], ['SKELETONMAGE', true], ['ZOMBIE', false],
        ['DEMON', true], ['IMP', false], ['SPIDER', true], ['WRAITH', false]]
  const requestedFamilies = process.env.SDR_ETHER_DRAIN_CAPTURE_FAMILIES?.split(',').filter(Boolean)
  if (requestedFamilies) assert.ok(requestedFamilies.length > 0
    && requestedFamilies.every(token => captureFamilies.some(([family]) => family === token)), 'unknown capture-family filter')
  for (const [enemyToken, enhanced] of captureFamilies.filter(([family]) => !requestedFamilies || requestedFamilies.includes(family))) {
    Object.assign(host.state(), { enhancedEffects: enhanced })
    const current = await fieldFixture(config)
    move(host, playerId, { x: lane.center.x + lane.direction.x * 350, y: lane.center.y + lane.direction.y * 350 })
    const sampleMark = await page.evaluate(() => window.__secondaryRenderSamples.length)
    const audioMark = await page.evaluate(() => window.__sdrAudioEvents.length)
    const clipMark = await page.evaluate(() => window.__secondaryCaptureMaskSamples.length)
    // A fast new Imp can leave contact range before the next100-tick query.
    // Seed on the real refresh boundary instead of changing field admission.
    await waitUntil(() => host.state().secondaryAbilities.actors.find(actor => actor.id === current.id)?.quantity === 1,
      'capture fixture missed the native query boundary')
    const source = host.state(), managers = createNativeWorldManagerOrder(source.worldManagerOrder)
    const seeded = stepBoneyardEnemyStore({ ...source.world.enemies, actors: [], maggots: [], deathEffects: [], projectiles: [], lastStepTick: source.tick - 1 }, {
      players: {}, projectileWorldBlocked: () => false, registerWorldPainter: managers.register,
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      resolveSpawnIntents: () => [{ enemyToken, flags: enemyToken === 'ZOMBIE' ? ['FLAG_ROTTEN'] : enemyToken === 'IMP' ? ['FLAG_SPLIT'] : [],
        id: 1, locationPolicy: 'anywhere', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
        position: current.position, spawnTick: source.tick, waveOrdinal: 1 }], tick: source.tick,
    })
    Object.assign(source, { world: { ...source.world, enemies: { ...seeded.store,
      actors: seeded.store.actors.map(actor => ({ ...actor, currentHealth: .001, config: { ...actor.config, experience: 0 } })) } },
      worldManagerOrder: managers.state() })
    const activeBounds = source.world.arenaTransition?.phase === 'sealed' ? source.world.arenaTransition.combatBounds : source.world.bounds
    const collision = withBoneyardGateCollision(source.world.collision, source.world.gateLeaves)
    assert.ok(seeded.store.actors.every(actor => canPlaceBoneyardBody(actor.position, activeBounds, collision,
      boneyardEnemyCollisionRadius(actor))), `${enemyToken} capture fixture must fit its actual body radius`)
    console.log(JSON.stringify({ captureFixture: { enemyToken, tick: source.tick, fieldPosition: current.position,
      actors: source.world.enemies.actors.map(actor => ({ id: actor.id, position: actor.position, currentHealth: actor.currentHealth,
        radius: boneyardEnemyCollisionRadius(actor) })) } }))
    try {
      await waitUntil(() => host.state().world.enemies.actors.every(actor => !seeded.store.actors.some(victim => victim.id === actor.id)),
        `${enemyToken} fixture actor did not retire`)
    } catch (error) {
      console.error(JSON.stringify({ captureFailure: { enemyToken, tick: host.state().tick,
        actors: host.state().world.enemies.actors.filter(actor => seeded.store.actors.some(victim => victim.id === actor.id)),
        field: host.state().secondaryAbilities.actors.find(actor => actor.id === current.id) } }))
      throw error
    }
    assert.equal(host.state().world.enemies.deathEffects.length, 0)
    assert.equal(host.state().world.enemies.spiderRemains.length, 0)
    assert.equal(host.state().world.enemies.projectiles.some(actor => actor.kind === 'poison-pool'), false)
    await page.waitForTimeout(300)
    const observed = await page.evaluate(({ mark, id }) => [...new Set(window.__secondaryRenderSamples.slice(mark)
      .flatMap(sample => sample.actors.filter(actor => actor.id === id)).flatMap(actor => actor.mainDrawMembers))],
    { mark: sampleMark, id: current.id })
    const sounds = await page.evaluate(mark => window.__sdrAudioEvents.slice(mark), audioMark)
    const audio = sounds.filter(event => /crunchdrain/i.test(event.src ?? ''))
    const phaseAudio = sounds.filter(event => /\/phase-[^/]+\.wav$/i.test(event.src ?? '') && event.playbackRate === 1.5)
    const clips = await page.evaluate(({ mark, id }) => window.__secondaryCaptureMaskSamples.slice(mark)
      .filter(sample => sample.parentLabel === `native-secondary:ether-drain:${id}` && sample.mask !== null),
    { mark: clipMark, id: current.id })
    const supported = enemyToken.startsWith('SKELETON') || enemyToken === 'ZOMBIE' || enemyToken === 'DEMON'
    if (supported) {
      assert.ok(observed.some(draw => {
        const [atlas, entry, blend] = draw.split(':')
        const value = Number(entry)
        return blend === 'normal' && (enemyToken === 'DEMON' ? atlas === 'Demon' && value >= 80 && value <= 97
          : atlas === 'BadGuys' && (enemyToken === 'ZOMBIE' ? value >= 2293 && value <= 2346 : value >= 1477 && value <= 1584))
      }),
      `${enemyToken} capture artwork was not sampled by the compiled renderer`)
      assert.ok(observed.includes('BadGuys:9:normal') && observed.includes('BadGuys:8:normal'),
        `${enemyToken} clipped capture rims were not sampled`)
      assert.ok(audio.length > 0, `${enemyToken} crunch audio was not observed`)
      assert.ok(phaseAudio.length > 0, `${enemyToken} phase callback pitch 1.5 was not observed`)
      assert.ok(clips.some(sample => sample.mask.connected && sample.mask.label === 'ether-drain-capture-clip'
        && sample.mask.x === -100 && sample.mask.y === -110 && sample.mask.width === 200 && sample.mask.height === 110),
      `${enemyToken} actual sprite clip was not observed`)
      const retainedMask = await page.evaluate(id => window.__sdrPixiApps.some(app => {
        const visit = node => node.label === `native-secondary:ether-drain:${id}`
          ? node.children.some(child => child.label === 'ether-drain-capture-clip')
          : (node.children ?? []).some(visit)
        return app.stage ? visit(app.stage) : false
      }), current.id)
      assert.equal(retainedMask, false, `${enemyToken} private clip was not detached after retirement`)
      assert.ok(audio.every(event => event.playbackRate >= .89 && event.playbackRate <= 1.01),
        'captured crunch retains its native pitch range')
    } else assert.equal(audio.length, 0)
    assert.equal(host.state().secondaryAbilities.actors.find(actor => actor.id === current.id).etherDrain.animations
      .some(animation => animation.kind === 'captured'), false)
    captures.push({ enemyToken, enhanced, supported, observed, audio, phaseAudio, clips })
    console.log(JSON.stringify({ capturePassed: captures.at(-1) }))
  }
  cases.push({ kind: 'capture-families', cases: captures })

  const partyField = await fieldFixture(config)
  const peerId = 'drain-built-peer'
  Object.assign(host.state(), addPlayerCharacter(host.state(), peerId, { discipline: 'arcane', displayName: 'Drain peer', element: 'ether' }))
  const peerPosition = { x: Math.fround(lane.center.x + lane.direction.x * 100), y: Math.fround(lane.center.y + lane.direction.y * 100) }
  move(host, peerId, peerPosition)
  await waitUntil(() => host.state().secondaryAbilities.actors.find(actor => actor.id === partyField.id)?.etherDrain
    .queried.some(ref => ref.kind === 'player' && ref.id === peerId), 'the next native field query did not admit the new peer')
  const start = host.state().tick
  await waitUntil(() => host.state().tick >= start + 10, 'declared peer did not advance')
  assert.ok(Math.hypot(getPlayerCharacter(host.state(), peerId).position.x - lane.center.x,
    getPlayerCharacter(host.state(), peerId).position.y - lane.center.y) < 100)
  const beforeSave = structuredClone(host.state())
  const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: host.loadedBoneyard(), mods: [], modState: {},
    playerId, state: beforeSave })
  const restored = restoreGameSaveDocument(saved).state
  assert.deepEqual(restored.secondaryAbilities.actors.find(actor => actor.id === partyField.id).etherDrain,
    beforeSave.secondaryAbilities.actors.find(actor => actor.id === partyField.id).etherDrain)
  const resumed = stepGameSimulationTick(restored, {})
  assert.ok(resumed.secondaryAbilities.actors.find(actor => actor.id === partyField.id).etherDrain)
  assert.equal(restored.playerEntities.identities.some(identity => identity.playerId === peerId), false)
  assert.equal(resumed.secondaryAbilities.actors.find(actor => actor.id === partyField.id).etherDrain.queried
    .some(ref => ref.kind === 'player' && ref.id === peerId), false)
  Object.assign(host.state(), restored)
  await waitUntil(() => host.state().tick >= restored.tick + 5, 'restored host did not resume')
  cases.push({ kind: 'party-save', declaredPeerPressure: true, localSaveOwnerProjection: true, compiledResume: true })

  // Skill books enter the normal offer flow, so this control runs after the other casts.
  const field = await fieldFixture(config)
  move(host, playerId, { x: lane.center.x + lane.direction.x * 350, y: lane.center.y + lane.direction.y * 350 })
  const order = createNativeWorldManagerOrder(host.state().worldManagerOrder)
  const loot = spawnBoneyardLootSpecs({ ...host.state().world.loot, actors: [] }, [
    { activationDelayTicks: 0, id: 1, kind: 'orb', nativeTypeId: 2011, orbKind: 'mana', value: .5,
      phase: 0, position: field.position, source: 'script' },
    ...[0, 1, 2].map((bonusKind, index) => ({ activationDelayTicks: 0, id: index + 2, kind: 'bonus',
      nativeTypeId: 2038, bonusKind, phase: 0, position: field.position, source: 'script' })),
  ], host.state().tick, order.register).store
  Object.assign(host.state(), { world: { ...host.state().world, loot }, worldManagerOrder: order.state() })
  const floaterPositions = loot.actors.map(({ id, position }) => ({ id, position: { ...position } }))
  const survivalStart = host.state().tick
  await waitUntil(() => host.state().tick >= survivalStart + 25, 'normal floaters did not advance')
  assert.equal(host.state().world.loot.actors.length, 4)
  assert.deepEqual(host.state().world.loot.actors.map(({ id, position }) => ({ id, position })), floaterPositions)
  move(host, playerId, field.position)
  await waitUntil(() => host.state().world.loot.actors.length === 0, 'normal Orb/Bonus pickup did not reach its consumer')
  // Bonus0 uses the normal picker/barrier. Resolve it through the existing UI
  // before testing lethal damage, so a legitimate paused offer does not mask it.
  assert.ok(getPlayerProgression(host.state(), playerId).pendingOffer)
  const picker = page.locator('.skill-picker-stage')
  await picker.locator('xpath=self::*[@data-reveal-interactive="true"]').waitFor({ timeout: 15000 })
  await picker.locator('.skill-picker-action').first().click()
  await picker.waitFor({ state: 'detached', timeout: 15000 })
  await waitUntil(() => host.state().levelUpBarrier === null
    && getPlayerProgression(host.state(), playerId).pendingOffer === null, 'normal Bonus offer did not release its barrier')
  await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 15000 })
  cases.push({ kind: 'orb-bonus', preservedAtField: true, normalPickup: true, actualOfferSelected: true })

  const lethal = field
  const observer = addPlayerCharacter(host.state(), 'drain-lethal-observer', { discipline: 'arcane', displayName: 'Drain observer', element: 'ether' })
  Object.assign(host.state(), observer)
  move(host, 'drain-lethal-observer', { x: lane.center.x + lane.direction.x * 700, y: lane.center.y + lane.direction.y * 700 })
  move(host, playerId, lethal.position)
  const playerIndex = host.state().playerEntities.identities.findIndex(identity => identity.playerId === playerId)
  Object.assign(host.state(), { playerEntities: { ...host.state().playerEntities,
    progressions: host.state().playerEntities.progressions.map((value, index) => index === playerIndex
      ? { ...value, currentHealth: 6, maximumHealth: 50 } : value) } })
  await waitUntil(() => getPlayerProgression(host.state(), playerId).lifeState !== 'alive', 'center contact did not reach lethal health')
  assert.ok(getPlayerProgression(host.state(), playerId).currentHealth <= -10)
  const screenshot = `${screenshotRoot}/ether-drain-center-lethality.png`
  await page.screenshot({ path: screenshot })
  const terminal = getPlayerProgression(host.state(), playerId)
  cases.push({ kind: 'center-lethality', lifeState: terminal.lifeState, health: terminal.currentHealth, screenshot })
  const graphicsRenderer = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null
  })
  assert.ok(graphicsRenderer)
  assert.doesNotMatch(graphicsRenderer, /swiftshader|llvmpipe|lavapipe|software/i)
  return { remainingOnly, scope: 'Compiled local client/live host with explicit rank/health/position/enemy/peer fixtures; no captured retail input trace. Remaining-only mode preserves earlier qualified receipts rather than replaying them.',
    cases, lane, graphicsRenderer }
}

async function fieldFixture(config, passives = []) {
  const { host, playerId, armQuickbar, baseSkillBook, stabilizeBoneyardCooldownEnemies, page, canvas, castSecondaryPointer, lane } = config
  armQuickbar(host, playerId, baseSkillBook, [74])
  let source = host.state()
  for (const skillId of passives) {
    const granted = grantPlayerEntitySkillRanks(source.playerEntities, playerId, skillId, 1, source.gameRng)
    Object.assign(source, { playerEntities: granted.store, gameRng: granted.rng })
  }
  source = host.state()
  Object.assign(source, { playerEntities: { ...source.playerEntities, progressions: source.playerEntities.progressions.map((value, index) =>
    source.playerEntities.identities[index].playerId === playerId ? { ...value, currentHealth: 1000000, maximumHealth: 1000000,
      currentMana: 10000, maximumMana: 10000 } : value) } })
  stabilizeBoneyardCooldownEnemies(host)
  move(host, playerId, lane.center)
  await page.waitForTimeout(250)
  await waitUntil(() => {
    const player = host.state().secondaryAbilities.players[playerId]
    return player.castAction === null && player.castSpinTicksRemaining === 0
      && player.globalCooldownTicks === 0 && player.cooldownTicksBySkill[74] === 0
  }, 'field fixture action/spin/cooldown gates did not finish')
  const pointer = await canvas.evaluate((node, point) => {
    const frame = node.__sdrBoneyardFrame, rect = node.getBoundingClientRect()
    return { x: rect.left + rect.width / 2 + (point.x - frame.cameraX) * frame.cameraZoom * rect.width / Number(node.dataset.viewportWidth),
      y: rect.top + rect.height / 2 + (point.y - frame.cameraY) * frame.cameraZoom * rect.height / Number(node.dataset.viewportHeight) }
  }, lane.center)
  await castSecondaryPointer(page, pointer)
  try {
    await waitUntil(() => host.state().secondaryAbilities.actors.some(actor => actor.kind === 'ether-drain' && actor.alpha === 1), 'field fixture failed')
  } catch (error) {
    console.error(JSON.stringify({ fieldFixtureFailure: { pointer, tick: host.state().tick, runPhase: host.state().run.phase,
      progression: getPlayerProgression(host.state(), playerId), player: host.state().secondaryAbilities.players[playerId],
      actors: host.state().secondaryAbilities.actors.map(({ id, kind, alpha, phase }) => ({ id, kind, alpha, phase })) } }))
    throw error
  }
  return host.state().secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')
}

function move(host, id, position) {
  const source = host.state()
  Object.assign(source, { playerEntities: replacePlayerCharacter(source.playerEntities, id,
    { ...getPlayerCharacter(source, id), position: { x: Math.fround(position.x), y: Math.fround(position.y) }, velocity: { x: 0, y: 0 } }) })
}

function clearLane(world) {
  // Demon is the largest capture fixture at native radius35; validate that body,
  // then check each actual spawned member again after the pointer's aim mapping.
  const bounds = world.arenaTransition?.phase === 'sealed' ? world.arenaTransition.combatBounds : world.bounds
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const bodies = [...boneyardEnemyBodies(world.enemies), ...boneyardLanternBodies(world.lanternPosition)]
  for (let y = bounds.y + 100; y < bounds.y + bounds.h - 100; y += 100) {
    for (let x = bounds.x + 100; x < bounds.x + bounds.w - 100; x += 100) {
      for (const direction of [{ x: 1, y: 0, key: 'd' }, { x: -1, y: 0, key: 'a' }, { x: 0, y: 1, key: 's' }, { x: 0, y: -1, key: 'w' }]) {
        if (Array.from({ length: 20 }, (_, i) => i * 20).every(offset => {
          const point = { x: x + direction.x * offset, y: y + direction.y * offset }
          return canPlaceBoneyardBody(point, bounds, collision, 35)
            && bodies.every(body => Math.hypot(body.position.x - point.x, body.position.y - point.y) > body.radius + 35)
        })) return { center: { x, y }, direction }
      }
    }
  }
  throw new Error('No actual collision-clear 380-unit lane found')
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)) }
  throw new Error(message)
}
