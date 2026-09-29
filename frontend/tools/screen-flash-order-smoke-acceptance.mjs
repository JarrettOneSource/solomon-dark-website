import assert from 'node:assert/strict'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { nativeFacultyRecipe } from '../src/game/core-kernels/native-survival-faculty.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { getPlayerCharacter, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'

/** Controlled actual writers on the supported built client/host transport. */
export async function acceptSharedScreenFlashOrder({ page, canvas, host, playerId, armQuickbar, baseSkillBook, wireSamples }) {
  const environment = { arenaTransition: host.state().world.arenaTransition,
    encounter: host.state().world.encounter, waves: host.state().world.waves,
    enemies: host.state().world.enemies }
  const captures = await canvas.evaluate(node => {
    const frame = node.__sdrBoneyardFrame
    const samples = []
    let color = frame.secondaryScreenFlashColor
    Object.defineProperty(frame, 'secondaryScreenFlashColor', {
      configurable: true, get: () => color,
      set(value) {
        color = value
        const gl = node.getContext('webgl2')
        const pixel = new Uint8Array(4)
        // The producer updates this field immediately after application.render().
        gl.readPixels(Math.trunc(node.width * .1), Math.trunc(node.height * .7), 1, 1,
          gl.RGBA, gl.UNSIGNED_BYTE, pixel)
        samples.push({ tick: frame.tick, frame: frame.frameCount,
          alpha: frame.secondaryScreenFlashAlpha, color, rgba: Array.from(pixel),
          glError: gl.getError(), framebufferBound: gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null })
        if (samples.length > 1000) samples.shift()
      },
    })
    window.__sharedFlashAtomicSamples = samples
    return samples.length
  })
  assert.equal(captures, 0)
  const receipts = []
  for (const mode of ['co-batched', 'split', 'same-tick']) {
    armQuickbar(host, playerId, baseSkillBook, [35])
    let state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    // Isolate the writers from the random wave, retaining the real arena/renderer.
    state = { ...state, screenFlashes: { epoch: state.screenFlashes.epoch + 1,
      nextOrder: state.screenFlashes.nextOrder, writes: [] }, world: { ...state.world,
      arenaTransition: null, encounter: null, waves: null, enemyEvents: [],
      enemies: createBoneyardEnemyStore(`shared-flash-${mode}`) } }
    Object.assign(host.state(), state)
    await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')
      .__sdrBoneyardFrame.secondaryScreenFlashAlpha === 0)
    const firstOrder = host.state().screenFlashes.nextOrder
    const mark = await page.evaluate(() => window.__sharedFlashAtomicSamples.length)
    const input = { aim: null, movement: { x: 0, y: 0 }, viewportWidth: 1600,
      viewportHeight: 900, cast: { primary: false, quickbar: 0 } }
    let ringState
    let final
    if (mode === 'same-tick') {
      state = dyingFaculty(host.state(), playerId)
      final = stepGameSimulationTick(state, { [playerId]: input })
      assert.deepEqual(final.screenFlashes.writes.slice(-2).map(write => write.flash.red), [0, Math.fround(.9)])
    } else {
      ringState = stepGameSimulationTick(host.state(), { [playerId]: input })
      assert.equal(ringState.screenFlashes.writes.at(-1).flash.red, Math.fround(.9))
      if (mode === 'split') {
        Object.assign(host.state(), ringState)
        await page.waitForFunction(mark => window.__sharedFlashAtomicSamples.slice(mark)
          .some(sample => sample.color === 0xe5ffff && sample.alpha > .8), mark)
        ringState = host.state()
      }
      final = stepGameSimulationTick(dyingFaculty(ringState, playerId), {})
      assert.deepEqual(final.screenFlashes.writes.slice(-2).map(write => write.flash.red), [Math.fround(.9), 0])
    }
    const expectedColor = mode === 'same-tick' ? 0xe5ffff : 0
    const lastWrite = final.screenFlashes.writes.at(-1)
    Object.assign(host.state(), final)
    const observedHandle = await page.waitForFunction(({ mark, expectedColor, tick }) =>
      window.__sharedFlashAtomicSamples.slice(mark).find(sample => sample.tick >= tick
        && sample.color === expectedColor && sample.alpha > .8),
    { mark, expectedColor, tick: lastWrite.tick }, { timeout: 15000 })
    const observed = await observedHandle.jsonValue()
    await observedHandle.dispose()
    assert.equal(observed.glError, 0)
    assert.equal(observed.framebufferBound, false)
    if (expectedColor === 0) assert.ok(Math.max(...observed.rgba.slice(0, 3)) < 70, JSON.stringify(observed))
    else assert.ok(observed.rgba[1] > observed.rgba[0] && observed.rgba[1] > 150, JSON.stringify(observed))
    const early = await page.evaluate(({ mark, tick, expectedColor }) =>
      window.__sharedFlashAtomicSamples.slice(mark).filter(sample => sample.tick < tick
        && sample.alpha > 0 && sample.color === expectedColor),
    { mark, tick: lastWrite.tick, expectedColor })
    assert.deepEqual(early, [], 'New write must wait for presentation eligibility')
    const wire = wireSamples.find(sample => sample.screenFlashes.writes.some(write => write.order === lastWrite.order))
    assert.ok(wire, 'Real WebSocket frame must carry both authoritative writes')
    const writes = wire.screenFlashes.writes.filter(write => write.order >= firstOrder)
    assert.deepEqual(writes.slice(0, 2), final.screenFlashes.writes.slice(-2))
    receipts.push({ mode, writes, observed, earlyWriteCount: early.length,
      transport: 'Normal server snapshot codec, entity materializer and Boneyard presentation timeline',
      pixels: 'Synchronous gl.readPixels in the diagnostics setter immediately after actual application.render()' })
  }
  const restored = host.state()
  Object.assign(restored, { world: { ...restored.world, ...environment },
    screenFlashes: { epoch: restored.screenFlashes.epoch + 1,
      nextOrder: restored.screenFlashes.nextOrder, writes: [] } })
  return { receipts, fixture: 'Actual Ring cast and Faculty lethal/death emitters; owned isolated battle in current arena',
    limit: 'Controlled web integration; does not replay the old retail clip or identify its sampler/writer' }
}

function dyingFaculty(state, playerId) {
  const manager = createNativeWorldManagerOrder(state.worldManagerOrder)
  const actorPosition = getPlayerCharacter(state, playerId).position
  let enemies = stepBoneyardEnemyStore(createBoneyardEnemyStore('shared-flash-faculty'), {
    players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: manager.register, resolveMovement: ({ position }) => position,
    resolveSpawnIntents: () => [{ enemyToken: 'DIREFACULTY', flags: [], id: 100000,
      authoredRecipe: nativeFacultyRecipe('9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9', 'Dire Sirmin'),
      locationPolicy: 'anywhere', nativeTypeId: 1010, pathfindingMode: 2,
      position: actorPosition, spawnTick: state.tick, waveOrdinal: 32 }], tick: state.tick,
  }).store
  const faculty = enemies.actors.find(actor => actor.config.enemyToken === 'DIREFACULTY')
  assert.ok(faculty)
  for (let attempt = 0; attempt < 2 && enemies.actors.find(actor => actor.id === faculty.id)?.lifeState === 'alive'; attempt += 1) {
    enemies = damageBoneyardEnemy(enemies, { actorId: faculty.id, amount: 1000000,
      tick: state.tick, sourcePlayerId: playerId, registerWorldPainter: manager.register }).store
  }
  assert.equal(enemies.actors.find(actor => actor.id === faculty.id).lifeState, 'dying')
  return { ...state, worldManagerOrder: manager.state(), world: { ...state.world, enemies } }
}
