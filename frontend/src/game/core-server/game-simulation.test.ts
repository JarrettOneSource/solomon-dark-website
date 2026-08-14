import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  addPlayerCharacter,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  removePlayerCharacter,
  stepGameSimulation,
  stepGameSimulationTick,
} from './game-simulation.ts'

function gameplayInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, secondary: false },
    movement: { x, y },
  }
}

test('game simulation owns player characters outside the active world', () => {
  const firstConfig = {
    discipline: 'arcane',
    displayName: 'Helvidius',
    element: 'ether',
  } as const
  const secondConfig = {
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  } as const
  let state = createGameSimulation({ first: firstConfig })
  assert.equal(state.accumulatorSeconds, 0)
  assert.equal(state.world.kind, 'hub')
  assert.equal('players' in state.world, false)
  assert.deepEqual(Object.keys(state.world.participants), ['first'])

  state = addPlayerCharacter(state, 'second', secondConfig)
  state = stepGameSimulationTick(state, {
    first: gameplayInput(1, 0),
    second: gameplayInput(0, 1),
  })
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.equal('players' in state, false)
  assert.deepEqual(getPlayerCharacter(state, 'first').config, firstConfig)
  assert.deepEqual(getPlayerCharacter(state, 'second').config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants).sort(), ['first', 'second'])
  assert.ok(getPlayerCharacter(state, 'first').position.x > getPlayerCharacter(state, 'second').position.x)
  assert.ok(getPlayerCharacter(state, 'second').position.y > getPlayerCharacter(state, 'first').position.y)

  state = removePlayerCharacter(state, 'first')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.throws(() => getPlayerCharacter(state, 'first'), /no player character/)
  assert.deepEqual(getPlayerCharacter(state, 'second').config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants), ['second'])
})

test('game simulation owns fixed-step accumulation independently of its world', () => {
  let state = createGameSimulation()
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 0)
  assert.equal(state.accumulatorSeconds, 0.005)
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
})

test('the authoritative tick latches footsteps only while native movement is active', () => {
  let state = createGameSimulation()
  for (let tick = 1; tick <= 100; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': gameplayInput(1, 0),
    })
    if (tick % 25 === 0) {
      assert.equal(getPlayerCharacter(state).footstepTick, tick)
    }
  }

  for (let tick = 101; tick <= 200; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': gameplayInput(0, 0),
    })
  }

  assert.equal(getPlayerCharacter(state).footstepTick, 100)
})

test('disconnect and world replacement clean spell actors and cast ownership', () => {
  const earth = {
    discipline: 'arcane',
    displayName: 'Earth Caster',
    element: 'earth',
  } as const
  let state = createGameSimulation({ caster: earth })
  const cast = (primary: boolean) => ({
    aim: {
      x: getPlayerCharacter(state, 'caster').position.x,
      y: getPlayerCharacter(state, 'caster').position.y - 200,
    },
    cast: { primary, secondary: false },
    movement: { x: 0, y: 0 },
  })
  state = stepGameSimulationTick(state, { caster: cast(true) })
  assert.equal(state.primarySpells.projectiles.length, 1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, true)
  state = removePlayerCharacter(state, 'caster')
  assert.deepEqual(state.primarySpells.projectiles, [])

  state = createGameSimulation({ caster: { ...earth, element: 'fire' } })
  for (let tick = 0; tick < 20; tick += 1) {
    state = stepGameSimulationTick(state, { caster: cast(true) })
  }
  assert.equal(state.primarySpells.projectiles.length, 1)
  state = enterBoneyardWorld(state, emptyBoneyard())
  assert.deepEqual(state.primarySpells, { nextId: 1, projectiles: [], transients: [] })
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.actionTick, -1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, false)
})

test('Boneyard Air falls back to a Gravestone and publishes the native curved segment', () => {
  let state = createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Air Caster',
    element: 'air',
  } })
  const loaded = emptyBoneyard()
  loaded.scene.objects = [{
    eid: 'grave-target',
    overlayVariant: 8,
    pos: { x: 250, y: 100 },
    secondaryVariant: 0,
    secondaryVisible: false,
    typeId: 2029,
    variant: 0,
  }]
  state = enterBoneyardWorld(state, loaded)
  const player = getPlayerCharacter(state, 'caster')
  state = stepGameSimulationTick(state, { caster: {
    aim: { x: 250, y: 50 },
    cast: { primary: true, secondary: false },
    movement: { x: 0, y: 0 },
  } })

  const bolt = state.primarySpells.transients[0]
  assert.equal(bolt.kind, 'air')
  assert.equal(bolt.targetId, 'scenery:grave-target')
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.targetId, bolt.targetId)
  assert.deepEqual(bolt.endpoint, { x: 250, y: 80 })
  assert.equal(bolt.midpoint.x, bolt.origin.x)
  assert.notDeepEqual(bolt.midpoint, {
    x: (bolt.origin.x + bolt.endpoint.x) / 2,
    y: (bolt.origin.y + bolt.endpoint.y) / 2,
  })
  assert.deepEqual(player.position, getPlayerCharacter(state, 'caster').position)
})

function emptyBoneyard(): LoadedBoneyard {
  return {
    choice: { id: 'empty', name: 'Empty', source: 'default' },
    geometrySha256: 'b'.repeat(64),
    runId: 'spell-cleanup-run',
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 },
      environmentMode: 2,
      fences: [],
      name: 'Spell cleanup fixture',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 },
      sprites: [],
      terrain: [],
    },
    seed: 'spell-cleanup-seed',
    sourceSha256: 'a'.repeat(64),
  }
}
