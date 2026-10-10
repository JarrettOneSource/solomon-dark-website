import assert from 'node:assert/strict'
import test from 'node:test'

import { HAGATHA_PERKS } from './core-kernels/hub-economy.ts'
import { createNativeHagathaRuntimeState } from './core-kernels/native-hagatha-effects.ts'
import { createGameSimulation, enterBoneyardWorld } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { projectRunCharmStatus, sameRunCharmStatus } from './run-charm-status.ts'

function snapshot() {
  return createGameSnapshot(enterBoneyardWorld(createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Owner', element: 'ether' },
    peer: { discipline: 'arcane', displayName: 'Peer', element: 'fire' },
  }), {
    choice: { id: 'empty', name: 'Empty', source: 'default' },
    geometrySha256: 'b'.repeat(64), runId: 'charm-hud', seed: 'charms', sourceSha256: 'c'.repeat(64),
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
      fences: [], name: 'Charms', objects: [], roads: [], solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [],
    },
  }), 'owner')
}

test('every stock catalog member uses its stock icon and existing readiness source', () => {
  for (const perk of HAGATHA_PERKS) {
    const state = snapshot()
    state.players.owner!.economy.ownedPerkSelectors = [perk.selector]
    state.players.owner!.economy.equipment = { ...state.players.owner!.economy.equipment, weapon: null }
    state.players.owner!.progression.hagathaRuntime = {
      cheatDeathCharges: 1, reverieActive: true, serendipityActive: true,
    }
    const rows = projectRunCharmStatus(state, 'owner')
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.record, 127 + perk.selector)
    assert.equal(rows[0]!.name, perk.name)
    assert.equal(rows[0]!.active, true)
    assert.match(rows[0]!.detail, /^Active\./)
  }
})

test('spent and weapon-disabled charms stay visible and reactivation restores active styling', () => {
  const state = snapshot()
  state.players.owner!.economy.ownedPerkSelectors = [7, 20, 24, 25]
  state.players.owner!.progression.hagathaRuntime = createNativeHagathaRuntimeState()
  assert.ok(state.players.owner!.economy.equipment.weapon)
  const spent = projectRunCharmStatus(state, 'owner')
  assert.equal(spent.length, 4)
  assert.ok(spent.every(charm => !charm.active && charm.detail.startsWith('Inactive.')))
  state.players.owner!.economy.equipment = { ...state.players.owner!.economy.equipment, weapon: null }
  state.players.owner!.progression.hagathaRuntime = {
    cheatDeathCharges: 1, reverieActive: true, serendipityActive: true,
  }
  const active = projectRunCharmStatus(state, 'owner')
  assert.ok(active.every(charm => charm.active))
  assert.equal(sameRunCharmStatus(spent, active), false)
  assert.equal(sameRunCharmStatus(active, projectRunCharmStatus(state, 'owner')), true)
})

test('maximum ordered ownership preserves both Tonics and never leaks peer or stale run state', () => {
  const state = snapshot()
  const owned = [27, 24, 25, 27, 7, 20, 0, 1, 2]
  state.players.owner!.economy.ownedPerkSelectors = owned
  state.players.peer!.economy.ownedPerkSelectors = [5]
  assert.deepEqual(projectRunCharmStatus(state, 'owner').map(charm => charm.selector), owned)
  assert.deepEqual(projectRunCharmStatus(state, 'peer').map(charm => charm.selector), [5])
  assert.deepEqual(projectRunCharmStatus(state, 'missing'), [])
  state.players.owner!.economy.ownedPerkSelectors = []
  assert.deepEqual(projectRunCharmStatus(state, 'owner'), [])
  for (const phase of ['game-over', 'hub', 'loadout'] as const) {
    assert.deepEqual(projectRunCharmStatus({ ...state, run: { ...state.run, phase } }, 'peer'), [])
  }
  assert.deepEqual(projectRunCharmStatus({ ...state, run: { ...state.run, runId: 'another-run' } }, 'peer'), [])
})
