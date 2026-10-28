import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../../src/game/core-server/game-simulation.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../../src/game/core-server/player-entity-store.ts'
import {
  prepareModHost,
} from '../../src/game/host/prepared-mod-host.ts'
import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from '../../src/game/host/web-mod-content.ts'
import {
  checkWebLuaPackage,
} from '../../src/game/modding/definition/index.ts'
import { prepareModSession } from '../../src/game/modding/runtime/index.ts'
import { admitPreparedPackage } from './cli.mjs'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const examplesRoot = fileURLToPath(new URL('../../examples/web-lua/', import.meta.url))
const packageNames = [
  'apprentice-apothecary',
  'gravity-lesson',
  'monument-crypt',
]
const packageCache = new Map()

test('every showcase package passes production-shaped admission', async () => {
  for (const name of packageNames) {
    const content = await preparedPackage(name)
    assert.equal(content.compiledMods.length, 1, name)
    assert.ok(content.assets.length > 0, name)
    if (name === 'monument-crypt') {
      assert.equal(content.boneyards.length, 1)
      assert.ok(content.boneyards[0].scene.objects.some(object => object.typeId === 2009))
    }
  }
})

test('Apprentice Apothecary purchases, grants, statuses, stock, state, and pickups end to end', async () => {
  const content = await preparedPackage('apprentice-apothecary')
  let state = createGameSimulation({
    first: character('First'),
    second: character('Second'),
  })
  state = withGold(state, 'first', 200)
  state = withGold(state, 'second', 200)
  const host = await hostFor(content, () => state, candidate => { state = candidate })
  try {
    const shop = host.content.all().find(entry => entry.contentKind === 'shop')
    assert.ok(shop)
    host.purchaseShop('first', shop.contentId, 0)
    const firstMoondust = getPlayerEconomy(state, 'first').backpack
      .filter(item => item.kind === 'mod-item' && item.name === 'Moondust')
      .reduce((sum, item) => sum + item.quantity, 0)
    assert.equal(firstMoondust, 2)
    assert.equal(host.checkpoint().shops.stock[0].remaining, 4)
    assert.equal(host.runtimeProjection('second').projection.shop_stock.length, 0)
    assert.deepEqual(host.checkpoint().semanticState.values.map(row => ({
      key: row.key,
      scope: row.scope,
      value: row.value,
    })), [{
      key: 'tutorial.first_purchase',
      scope: { id: 'first', kind: 'participant-profile' },
      value: true,
    }])
    assert.equal(host.drainPresentation().length, 1)
    const ui = host.content.uis()[0]
    assert.ok(ui)
    assert.deepEqual(host.runtimeProjection('first').projection.ui_surfaces, [])
    state = enterBoneyardWorld(state, showcaseBoneyard('run-a'))
    assert.equal(
      host.runtimeProjection('first').projection.ui_surfaces[0]?.content_id,
      ui.contentId,
    )
    const ping = host.uiAction({
      action: 'ping',
      arguments: {},
      contentId: ui.contentId,
      playerId: 'first',
      requestId: 2,
    })
    assert.equal(ping.accepted, true, ping.errors.join('; '))
    assert.equal(host.drainPresentation()[0]?.fields.sound.key, 'page_sound')

    const potion = host.content.consumables().find(entry => entry.name === 'Ward Tonic')
    assert.ok(potion)
    const consumed = host.consume({
      content: potion.content,
      playerId: 'first',
      tick: 1,
      useId: 1,
    })
    assert.equal(consumed.accepted, true, consumed.errors.join('; '))
    assert.equal(host.checkpoint().statuses.instances.length, 1)

    const started = host.step([{ name: 'run.started', payload: { run_id: 'run-a' } }], 2, 'run-a')
    assert.equal(started.accepted, true, started.errors.join('; '))
    assert.equal(host.project().powerups.length, 1)
    const saved = host.saveState()
    host.tick(3)
    host.restoreSaveState(saved)
    assert.equal(host.project().powerups.length, 1)
    const reloaded = await hostFor(content, () => state, candidate => { state = candidate })
    try {
      reloaded.restoreSaveState(saved)
      assert.equal(reloaded.project().powerups.length, 1)
      assert.equal(reloaded.checkpoint().semanticState.values[0]?.key, 'tutorial.first_purchase')
    } finally {
      reloaded.close()
    }
  } finally {
    host.close()
  }
})

test('Gravity Lesson offers, unlocks, binds, casts, times, and saves reducer state end to end', async () => {
  const content = await preparedPackage('gravity-lesson')
  let state = createGameSimulation({ student: character('Student') })
  const host = await hostFor(content, () => state, candidate => { state = candidate })
  try {
    const sessionCell = host.checkpoint().session.state.cells.find(cell => cell.scope.kind === 'session')
    assert.deepEqual(sessionCell?.value, { demonstrations: 1 })
    state = grantGameSimulationPlayerExperience(state, 'student', 100)
    state = grantGameSimulationPlayerExperience(state, 'student', 100)
    const nativeOffer = getPlayerProgression(state, 'student').pendingOffer
    assert.ok(nativeOffer)
    host.step([{
      name: 'level.up',
      payload: { level: getPlayerProgression(state, 'student').level, player_id: 'student' },
    }], state.tick, 'gravity-run')
    const skill = host.content.skills().find(entry => entry.key === 'gravity_student')
    const offer = host.checkpoint().skills.offers.find(entry => entry.playerId === 'student')
    assert.ok(skill && offer)
    host.chooseSkill('student', skill.contentId, offer.sequence, nativeOffer.sequence)
    const well = host.content.spells().find(entry => entry.key === 'gravity_well')
    assert.ok(well)
    host.bindModQuickbar('student', 0, well.contentId)
    const cast = host.cast({
      contentId: well.contentId,
      context: { target_x: 300, target_y: 300 },
      playerId: 'student',
      requestId: 1,
    })
    assert.equal(cast.accepted, true, cast.errors.join('; '))
    assert.equal(getPlayerProgression(state, 'student').currentMana, 79)
    const castCell = host.checkpoint().session.state.cells.find(cell => cell.scope.kind === 'participant-run')
    assert.equal(castCell?.value.casts, 1)
    assert.equal(host.checkpoint().spellEffects.effects[0].kind, 'area')

    const current = host.checkpoint()
    host.restore({
      ...current,
      session: {
        ...current.session,
        state: {
          ...current.session.state,
          cells: current.session.state.cells.map(cell => cell.key === 'lesson_streak'
            ? { ...cell, schemaVersion: 1, value: { casts: 4 } }
            : cell),
        },
      },
    })
    const migrated = host.checkpoint().session.state.cells.find(cell => cell.key === 'lesson_streak')
    assert.deepEqual(migrated?.value, { active: true, casts: 4, rhythm: 0 })

    const started = host.step([{ name: 'run.started', payload: { run_id: 'gravity-run' } }], 1, 'gravity-run')
    assert.equal(started.accepted, true, started.errors.join('; '))
    assert.equal(host.checkpoint().session.timers.length, 2)
    host.step([], 101, 'gravity-run')
    assert.ok(host.drainPresentation().length >= 1)
    const checkpoint = host.checkpoint()
    host.step([], 201, 'gravity-run')
    host.restore(checkpoint)
    assert.equal(host.checkpoint().session.timers.length, checkpoint.session.timers.length)
  } finally {
    host.close()
  }
})

test('a real showcase reducer opens its circuit without disabling the rest of the package', async () => {
  const content = await preparedPackage('monument-crypt')
  const session = await prepareModSession({
    adapter: {
      prepare: () => ({ commit() {}, rollback() {} }),
    },
    mods: content.modSources.map((source, index) => ({
      compiled: content.compiledMods[index],
      entryScript: source.entryScript,
      entryScriptPath: 'scripts/main.lua',
      identity: source.identity,
    })),
    wasmPath,
  })
  try {
    for (let tick = 1; tick <= 3; tick += 1) {
      const result = session.step({
        events: [{
          context: { participant_id: 'player-1' },
          event: 'mod.enemy.damaged',
          payload: {},
          scope: { id: 'enemy-1', kind: 'entity' },
        }],
        tick,
      })
      assert.equal(result.intents.length, 0)
      assert.equal(result.errors.length, 1)
    }
    assert.deepEqual(
      session.reducerDiagnostics().find(row => row.key === 'keeper_phase'),
      {
        disabled: true,
        failures: 3,
        key: 'keeper_phase',
        modId: 'showcase.monument-crypt',
      },
    )
    assert.equal(session.catalog()[0]?.content.some(entry => entry.key === 'monument_boneyard'), true)
  } finally {
    session.close()
  }
})

test('real showcase reducers execute every public intent family and reducer scope', async () => {
  const gravity = await preparedPackage('gravity-lesson')
  const monument = await preparedPackage('monument-crypt')
  const observedIntents = new Set()
  const observedScopes = new Set([
    ...gravity.compiledMods.flatMap(mod => mod.reducers.map(reducer => reducer.scope)),
    ...monument.compiledMods.flatMap(mod => mod.reducers.map(reducer => reducer.scope)),
  ])
  const run = async (content, events) => {
    const session = await prepareModSession({
      adapter: { prepare: () => ({ commit() {}, rollback() {} }) },
      mods: content.modSources.map((source, index) => ({
        compiled: content.compiledMods[index],
        entryScript: source.entryScript,
        entryScriptPath: 'scripts/main.lua',
        identity: source.identity,
      })),
      wasmPath,
    })
    try {
      for (const [index, event] of events.entries()) {
        const result = session.step({ events: [event], tick: index + 1 })
        assert.equal(result.accepted, true, result.errors.join('; '))
        result.intents.forEach(intent => observedIntents.add(intent.kind))
      }
    } finally {
      session.close()
    }
  }
  await run(gravity, [{
    context: { participant_id: 'player-1' },
    event: 'action.content.cast',
    payload: {},
    scope: { id: 'player-1:run-1', kind: 'participant-run' },
  }])
  await run(monument, [{
    context: { participant_id: 'player-1' },
    event: 'mod.enemy.damaged',
    payload: { current_health: 100, maximum_health: 320 },
    scope: { id: 'enemy-1', kind: 'entity' },
  }, {
    context: { participant_id: 'player-1' },
    event: 'action.portal.enter',
    payload: {},
    scope: { id: 'run-1', kind: 'party-run' },
  }, {
    context: { participant_id: 'player-1' },
    event: 'action.scene.room',
    payload: { room_index: 1 },
    scope: { id: 'scene-1', kind: 'scene' },
  }])
  assert.deepEqual([...observedIntents].sort(), [
    'damage',
    'grant',
    'present',
    'resource',
    'spawn',
    'state',
    'status',
  ])
  assert.deepEqual([...observedScopes].sort(), [
    'entity',
    'participant-run',
    'party-run',
    'scene',
    'session',
  ])
})

test('Monument Crypt runs its map, portal, rooms, enemy, audio, reducers, and return end to end', async () => {
  const content = await preparedPackage('monument-crypt')
  const boneyard = content.boneyards[0]
  assert.ok(boneyard)
  let state = enterBoneyardWorld(
    createGameSimulation({ keeper_hunter: character('Keeper Hunter') }),
    { ...boneyard, runId: 'crypt-run', seed: '0011223344556677' },
  )
  const host = await hostFor(content, () => state, candidate => { state = candidate })
  try {
    const definition = host.content.all().find(entry => entry.contentKind === 'boneyard')
    assert.ok(definition)
    host.activateBoneyard(definition.contentId)
    host.tick(0)
    assert.equal(host.checkpoint().enemies.enemies.length, 1)
    const introHealth = getPlayerProgression(state, 'keeper_hunter').currentHealth
    for (let tick = 1; tick <= 150; tick += 1) host.tick(tick)
    assert.equal(getPlayerProgression(state, 'keeper_hunter').currentHealth, introHealth)
    const player = getPlayerCharacter(state, 'keeper_hunter')
    state = {
      ...state,
      playerEntities: replacePlayerCharacter(state.playerEntities, 'keeper_hunter', {
        ...player,
        position: { x: 1700, y: 1700 },
        velocity: { x: 0, y: 0 },
      }),
      world: state.world.kind === 'boneyard'
        ? { ...state.world, arenaTransition: null, encounter: null, waves: null }
        : state.world,
    }
    host.tick(151)
    assert.ok(getPlayerProgression(state, 'keeper_hunter').currentHealth < introHealth)
    assert.deepEqual(host.runtimeProjection('keeper_hunter').projection.audio_loops.map(row => row.path), [
      'audio/dungeon_ambient_1.ogg',
    ])

    const portal = host.runtimeProjection('keeper_hunter').projection.portals[0]
    assert.ok(portal)
    host.enterPortal({
      actorKind: 'monument',
      confirmedByLeader: true,
      ownerId: 'crypt-run',
      playerId: 'keeper_hunter',
      portalId: portal.id,
      scene: 'stock.boneyard',
    })
    assert.equal(host.activeScene('crypt-run')?.roomIndex, 0)
    assert.equal(getPlayerEconomy(state, 'keeper_hunter').backpack.some(item => (
      item.kind === 'mod-item' && item.name === 'Crypt Token'
    )), true)
    assert.equal(host.checkpoint().session.state.cells.some(cell => (
      cell.key === 'crypt_progress' && cell.scope.kind === 'party-run'
    )), true)

    host.selectSceneRoom('crypt-run', 1)
    assert.equal(host.activeScene('crypt-run')?.roomIndex, 1)
    assert.equal(host.checkpoint().enemies.enemies.length, 2)
    const enemy = host.checkpoint().enemies.enemies[0]
    const aura = host.content.spells().find(entry => entry.key === 'grave_aura')
    assert.ok(enemy && aura)
    const healthBeforeRetaliation = getPlayerProgression(state, 'keeper_hunter').currentHealth
    const cast = host.cast({
      contentId: aura.contentId,
      context: { target_x: enemy.x, target_y: enemy.y },
      playerId: 'keeper_hunter',
      requestId: 2,
    })
    assert.equal(cast.accepted, true, cast.errors.join('; '))
    host.tick(1)
    assert.equal(host.checkpoint().session.state.cells.some(cell => (
      cell.key === 'keeper_phase' && cell.scope.kind === 'entity'
    )), true)
    assert.equal(host.checkpoint().statuses.instances.length, 1)
    assert.equal(
      getPlayerProgression(state, 'keeper_hunter').currentHealth,
      healthBeforeRetaliation - 1,
    )

    const checkpoint = host.checkpoint()
    host.returnScene('crypt-run')
    assert.equal(host.activeScene('crypt-run'), null)
    host.restore(checkpoint)
    assert.equal(host.activeScene('crypt-run')?.roomIndex, 1)
  } finally {
    host.close()
  }
})

async function preparedPackage(name) {
  let pending = packageCache.get(name)
  if (pending) return pending
  pending = (async () => {
    const checked = await checkWebLuaPackage(join(examplesRoot, name), wasmPath)
    admitPreparedPackage(checked)
    const files = [...checked.files].map(([path, bytes]) => ({
      byteLength: bytes.length,
      bytesBase64: Buffer.from(bytes).toString('base64'),
      ...typedFile(path),
      path,
      sha256: digest(bytes),
    }))
    const contentSha256 = createHash('sha256')
      .update(checked.entryScript)
      .update(files.map(file => `${file.path}:${file.sha256}`).join('\0'))
      .digest('hex')
    const manifestSha256 = createHash('sha256')
      .update(`${checked.manifest.id}\0${checked.manifest.version}\0${contentSha256}`)
      .digest('hex')
    const materialized = materializeWebSessionContent({
      manifestSha256,
      mods: [{
        boneyards: [],
        contentSha256,
        entryScript: checked.entryScript,
        files,
        id: checked.manifest.id,
        name: checked.manifest.name,
        priority: 0,
        slug: checked.manifest.id,
        version: checked.manifest.version,
      }],
    })
    return compileWebSessionContentDefinitions(materialized, wasmPath)
  })()
  packageCache.set(name, pending)
  return pending
}

async function hostFor(content, read, write) {
  return prepareModHost({ content, state: { read, write }, wasmPath })
}

function character(displayName) {
  return { discipline: 'arcane', displayName, element: 'ether' }
}

function showcaseBoneyard(runId) {
  return {
    choice: { id: 'showcase', name: 'Showcase', source: 'default' },
    geometrySha256: '2'.repeat(64),
    runId,
    scene: {
      bounds: { h: 500, w: 500, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'Showcase Arena',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 },
      sprites: [],
      terrain: [],
    },
    seed: '0123456789abcdef',
    sourceSha256: '1'.repeat(64),
  }
}

function withGold(state, playerId, gold) {
  const economy = getPlayerEconomy(state, playerId)
  return {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      gold,
      revision: economy.revision + 1,
    }),
  }
}

function typedFile(path) {
  if (path.endsWith('.png')) return { contentType: 'image/png', kind: 'image' }
  if (path.endsWith('.ogg')) return { contentType: 'audio/ogg', kind: 'audio' }
  if (path.endsWith('.wav')) return { contentType: 'audio/wav', kind: 'audio' }
  if (path.endsWith('.mp3')) return { contentType: 'audio/mpeg', kind: 'audio' }
  if (path.endsWith('.boneyard')) {
    return { contentType: 'application/vnd.solomon-dark.boneyard', kind: 'boneyard' }
  }
  if (path.startsWith('scenes/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'scene' }
  }
  if (path.startsWith('art/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'art-metadata' }
  }
  if (path.endsWith('.bundle')) {
    return { contentType: 'application/vnd.solomon-dark.sprite-bundle', kind: 'sprite-bundle' }
  }
  throw new Error(`unsupported showcase file: ${path}`)
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
