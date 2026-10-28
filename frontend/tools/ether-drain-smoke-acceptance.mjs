import assert from 'node:assert/strict'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { applyNativeSecondaryGolemDamage } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { createNativeLootItemIds, miscItem } from '../src/game/core-kernels/native-loot-items.ts'
import { addPlayerCharacter, getPlayerCharacter, getPlayerEconomy, getPlayerProgression, removePlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { damagePlayerEntity, playerEntityCanCast, replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { spawnBoneyardLootSpecs } from '../src/game/core-server/boneyard-loot-store.ts'

// The maintained secondary harness owns the compiled client, live host, browser,
// error collection and teardown. Positions and clocks below are declared fixtures.
export async function acceptEtherDrain({ page, canvas, host, playerId, baseSkillBook, armQuickbar,
  castSecondaryPointer, stabilizeBoneyardCooldownEnemies, screenshotRoot }) {
  assert.equal(host.state().world.kind, 'boneyard')
  armQuickbar(host, playerId, baseSkillBook, [74, 45])
  // armQuickbar refreshes native skill/equipment stats. Apply this journey's
  // declared ample mana/health after that refresh, so both real casts can run.
  const armed = host.state()
  Object.assign(armed, { playerEntities: { ...armed.playerEntities,
    progressions: armed.playerEntities.progressions.map((progression, index) =>
      armed.playerEntities.identities[index].playerId !== playerId ? progression
        : { ...progression, currentHealth: 1000000, maximumHealth: 1000000,
            currentMana: 10000, maximumMana: 10000 }),
  } })
  stabilizeBoneyardCooldownEnemies(host)
  await page.waitForFunction(() => document.querySelector('.hub-hud-quickbar-slot[data-slot="0"]')
    ?.getAttribute('aria-label')?.startsWith('Ether Drain,'), undefined, { timeout: 10000 })
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  const screen = { x: bounds.x + bounds.width * .62, y: bounds.y + bounds.height * .5 }
  await page.mouse.move(screen.x, screen.y)
  await page.keyboard.press('1', { delay: 50 })
  await waitUntil(() => host.state().secondaryAbilities.actors.some(actor => actor.kind === 'golem'),
    'the public Golem quickbar did not produce its actor')
  await waitUntil(() => {
    const player = host.state().secondaryAbilities.players[playerId]
    return player.castAction === null && player.castSpinTicksRemaining === 0
      && player.globalCooldownTicks === 0 && player.cooldownTicksBySkill[74] === 0
  }, 'the native action, spin and cooldown gates did not finish')
  const beforeDrain = getPlayerProgression(host.state(), playerId)
  const admissionBeforeDrain = { currentMana: beforeDrain.currentMana, maximumMana: beforeDrain.maximumMana,
    currentHealth: beforeDrain.currentHealth, lifeState: beforeDrain.lifeState, pendingOffer: beforeDrain.pendingOffer,
    canCast: playerEntityCanCast(host.state().playerEntities, playerId) }
  await castSecondaryPointer(page, screen)
  try {
    await waitUntil(() => host.state().secondaryAbilities.actors.some(actor => actor.kind === 'ether-drain' && actor.alpha > .8),
      'the public Ether Drain quickbar did not produce an active field')
  } catch (error) {
    const player = host.state().secondaryAbilities.players[playerId]
    const progression = getPlayerProgression(host.state(), playerId)
    console.error(JSON.stringify({ etherDrainCastFailure: { screen, tick: host.state().tick, runPhase: host.state().run.phase,
      admissionBeforeDrain, admissionAfterDrain: { currentMana: progression.currentMana, maximumMana: progression.maximumMana,
        currentHealth: progression.currentHealth, lifeState: progression.lifeState, pendingOffer: progression.pendingOffer,
        canCast: playerEntityCanCast(host.state().playerEntities, playerId) },
      castSequence: player.castSequence, fizzleSequence: player.fizzleSequence, lastSkillId: player.lastSkillId,
      globalCooldownTicks: player.globalCooldownTicks, castAction: player.castAction, castSpinTicksRemaining: player.castSpinTicksRemaining,
      cooldown74: player.cooldownTicksBySkill[74], actors: host.state().secondaryAbilities.actors.map(actor => ({
        id: actor.id, kind: actor.kind, alpha: actor.alpha, phase: actor.phase, position: actor.position,
      })) } }))
    throw error
  }
  const field = host.state().secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')
  const center = { ...field.position }
  const actorRows = () => host.state().secondaryAbilities.actors
  const receipt = { scope: 'Compiled client and live host with declared object positions/settled states; no captured retail input trace.',
    fieldId: field.id, fieldCenter: center, enhancedEffects: host.state().enhancedEffects }

  const beforeLoot = getPlayerEconomy(host.state(), playerId)
  const order = createNativeWorldManagerOrder(host.state().worldManagerOrder)
  const loot = spawnBoneyardLootSpecs({ ...host.state().world.loot, actors: [] }, [
    { activationDelayTicks: 0, amount: 77, id: 1, kind: 'gold', nativeTypeId: 2012, phase: 0,
      position: center, source: 'script', tier: 2 },
    { activationDelayTicks: 0, id: 2, item: miscItem(createNativeLootItemIds(90000), 1), kind: 'sack',
      nativeTypeId: 2013, phase: 0, position: center, source: 'script' },
  ], host.state().tick, order.register).store
  const lootIds = loot.actors.map(actor => actor.id)
  Object.assign(host.state(), { world: { ...host.state().world, loot }, worldManagerOrder: order.state() })
  await waitUntil(() => host.state().world.loot.actors.every(actor => !lootIds.includes(actor.id)),
    'the field did not retire the eligible Gold and carried Key')
  assert.equal(getPlayerEconomy(host.state(), playerId).gold, beforeLoot.gold)
  assert.deepEqual(getPlayerEconomy(host.state(), playerId).backpack, beforeLoot.backpack)
  receipt.loot = { ids: lootIds, retired: true, credited: false }

  const source = host.state()
  const golem = source.secondaryAbilities.actors.find(actor => actor.kind === 'golem')
  assert.ok(golem)
  const ready = { ...source.secondaryAbilities, actors: source.secondaryAbilities.actors.map(actor => actor.id === golem.id
    ? { ...actor, ageTicks: 400 } : actor) }
  const golemPainters = createNativeWorldManagerOrder(source.worldManagerOrder)
  const death = applyNativeSecondaryGolemDamage(ready, golem.id, { primaryDamage: 10000,
    secondaryDamage: 0, reflectablePhysicalSourceInRange: false }, source.tick, source.enhancedEffects, golemPainters.register).state
  const parent = death.actors.find(actor => actor.kind === 'golem-death')
  assert.ok(parent)
  const groundedX = Math.fround(center.x + 100)
  const airborneX = Math.fround(center.x + 150)
  const groundedY = Math.fround(center.y)
  const airborneY = Math.fround(center.y + 30)
  Object.assign(source, { worldManagerOrder: golemPainters.state(), secondaryAbilities: { ...death, actors: death.actors.map(actor => actor.id !== parent.id ? actor
    : { ...actor, golemDeath: { ...actor.golemDeath, fragments: actor.golemDeath.fragments.map((fragment, index) => {
      if (index > 2 || fragment === null) return null
      const airborne = index === 1
      return { ...fragment, bounceVelocity: airborne ? -2 : 0, height: airborne ? -30 : 0,
        velocity: { x: 0, y: 0 }, verticalVelocity: airborne ? -2 : 0, rotationStepDegrees: 0,
        position: { x: index === 0 ? groundedX : index === 1 ? airborneX : Math.fround(center.x + 9),
          y: airborne ? airborneY : groundedY } }
    }) } }) } })
  await waitUntil(() => actorRows().find(actor => actor.id === parent.id)?.golemDeath.fragments[2] === null,
    'the field did not consume the selected Golem fragment')
  await waitUntil(() => actorRows().find(actor => actor.id === parent.id)?.golemDeath.fragments[0]?.position.x < groundedX,
    'the field did not move the settled Golem fragment')
  assert.equal(actorRows().find(actor => actor.id === parent.id).golemDeath.fragments[1].position.x, airborneX)
  await page.waitForFunction(id => {
    const samples = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.secondaryAbilitySamples ?? []
    return samples.some(actor => actor.id === id && actor.mainDrawMembers.includes('DeadHawg:78:normal'))
      && samples.some(actor => actor.id === id && actor.mainDrawMembers.includes('DeadHawg:79:normal'))
      && !samples.some(actor => actor.id === id && actor.mainDrawMembers.includes('DeadHawg:80:normal'))
  }, parent.id, { timeout: 10000 })
  const golemScreenshot = `${screenshotRoot}/ether-drain-golem-members.png`
  await page.screenshot({ path: golemScreenshot })
  receipt.golem = { id: parent.id, groundedMoved: true, airborneX, consumedIndex: 2,
    sampled: await canvas.evaluate((node, id) => node.__sdrBoneyardFrame.secondaryAbilitySamples.filter(actor => actor.id === id), parent.id),
    screenshot: golemScreenshot }
  const groundSample = receipt.golem.sampled.find(actor => actor.mainDrawMembers.includes('DeadHawg:78:normal'))
  const airSample = receipt.golem.sampled.find(actor => actor.mainDrawMembers.includes('DeadHawg:79:normal'))
  assert.equal(groundSample.worldY, groundedY)
  assert.equal(airSample.worldY, airborneY)

  const departedId = 'ether-drain-fixture-departed'
  assert.equal(host.state().playerEntities.identities.some(identity => identity.playerId === departedId), false)
  const victim = addPlayerCharacter(host.state(), departedId, { discipline: 'arcane', displayName: 'Drain fixture', element: 'ether' })
  const placedVictim = replacePlayerCharacter(victim.playerEntities, departedId, {
    ...getPlayerCharacter(victim, departedId), position: { x: Math.fround(center.x + 100), y: groundedY },
    velocity: { x: 0, y: 0 },
  })
  Object.assign(host.state(), { ...victim,
    playerEntities: damagePlayerEntity(placedVictim, departedId, 10000, victim.tick) })
  await waitUntil(() => host.state().world.deathWeapons.some(actor => actor.ownerId === departedId),
    'the real player death did not produce a dropped weapon')
  const drop = host.state().world.deathWeapons.find(actor => actor.ownerId === departedId)
  Object.assign(host.state(), { world: { ...host.state().world, deathWeapons: host.state().world.deathWeapons.map(actor => actor.id !== drop.id ? actor
    : { ...actor, motion: { ...actor.motion, bounceVelocity: 0, height: 0, verticalVelocity: 0,
      rotationStepDegrees: 0, velocity: { x: 0, y: 0 }, position: { x: center.x + 100, y: center.y } } }) } })
  await page.waitForFunction(id => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    ?.painterOrder.some(layer => layer.id === `player-death-weapon:${id}`), drop.id, { timeout: 10000 })
  Object.assign(host.state(), removePlayerCharacter(host.state(), departedId))
  assert.ok(host.state().world.deathWeapons.some(actor => actor.id === drop.id))
  const retainedScreenshot = `${screenshotRoot}/ether-drain-weapon-owner-left.png`
  await page.waitForFunction(id => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    ?.painterOrder.some(layer => layer.id === `player-death-weapon:${id}`), drop.id, { timeout: 10000 })
  await page.screenshot({ path: retainedScreenshot })
  const consumeField = host.state().secondaryAbilities.actors.find(actor => actor.id === field.id)
  console.log(JSON.stringify({ weaponConsumeRequest: { tick: host.state().tick, center,
    field: consumeField ? { id: consumeField.id, ageTicks: consumeField.ageTicks, phase: consumeField.phase,
      alpha: consumeField.alpha, freezeTicks: consumeField.freezeTicks,
      refs: consumeField.etherDrain?.worldAnimationRefs } : null } }))
  Object.assign(host.state(), { world: { ...host.state().world, deathWeapons: host.state().world.deathWeapons.map(actor => actor.id !== drop.id ? actor
    : { ...actor, motion: { ...actor.motion, position: { x: center.x + 9, y: center.y } } }) } })
  try {
    await waitUntil(() => !host.state().world.deathWeapons.some(actor => actor.id === drop.id),
      'the field did not consume the independent weapon')
  } catch (error) {
    const currentField = host.state().secondaryAbilities.actors.find(actor => actor.id === field.id)
    console.error(JSON.stringify({ etherDrainWeaponFailure: { tick: host.state().tick,
      runPhase: host.state().run.phase, originalCenter: center, field: currentField ? {
        id: currentField.id, ageTicks: currentField.ageTicks, alpha: currentField.alpha,
        phase: currentField.phase, freezeTicks: currentField.freezeTicks, position: currentField.position,
        refs: currentField.etherDrain?.worldAnimationRefs,
      } : null, weapon: host.state().world.deathWeapons.find(actor => actor.id === drop.id) ?? null } }))
    throw error
  }
  await page.waitForFunction(id => !document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    ?.painterOrder.some(layer => layer.id === `player-death-weapon:${id}`), drop.id, { timeout: 10000 })
  receipt.weapon = { id: drop.id, ownerRemoved: true, retainedScreenshot, consumed: true, painterRetired: true }
  receipt.caster = { position: getPlayerCharacter(host.state(), playerId).position,
    velocity: getPlayerCharacter(host.state(), playerId).velocity }
  receipt.graphicsRenderer = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null
  })
  assert.ok(receipt.graphicsRenderer, 'the hardware renderer identity is required')
  assert.doesNotMatch(receipt.graphicsRenderer, /swiftshader|llvmpipe|lavapipe|software/i)
  return receipt
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error(message)
}
