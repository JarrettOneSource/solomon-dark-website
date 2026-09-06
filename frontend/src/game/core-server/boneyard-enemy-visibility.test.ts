import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdlePlayerCharacterInput, createPlayerCharacter } from '../core-kernels/player-character.ts'
import { createBoneyardEnemyVisibility } from './boneyard-enemy-visibility.ts'

const bounds = { x: 0, y: 0, w: 4000, h: 3000 }
const player = createPlayerCharacter({ discipline: 'body', displayName: 'Wizard', element: 'fire' }, { x: 2000, y: 1500 })

test('Heartmonger admission uses the native inherited actor rectangle and each player viewport', () => {
  const light = { intensity: .5, radius: .75, position: { x: 2520, y: 1500 } }
  const visibility = createBoneyardEnemyVisibility(bounds, { first: player },
    { first: createIdlePlayerCharacterInput(1350, 900) }, [light])
  assert.deepEqual(visibility.nativeVisibility(light.position), { admitted: true, intensity: .5 })
  assert.equal(visibility.nativeVisibility({ x: 2532, y: 1500 }).admitted, false)
  assert.equal(visibility.projectedPointVisible(light.position), false)
  const wider = createBoneyardEnemyVisibility(bounds, { first: player },
    { first: createIdlePlayerCharacterInput(1600, 900) }, [light])
  assert.equal(wider.projectedPointVisible(light.position), true)
})

test('native light admission is circular even where the elliptical intensity is zero', () => {
  const light = { intensity: 1, radius: 1, position: player.position }
  const visibility = createBoneyardEnemyVisibility(bounds, { first: player }, {}, [light])
  assert.deepEqual(visibility.nativeVisibility({ x: 2000, y: 1644 }), { admitted: true, intensity: 0 })
  assert.equal(visibility.nativeVisibility({ x: 2000, y: 1645 }).admitted, false)
})

test('detached Crow retention admits any participant view and retires when no view can see the projected bird', () => {
  const second = { ...player, position: { x: 3300, y: 2500 } }
  const visibility = createBoneyardEnemyVisibility(bounds, { first: player, second }, {}, [])
  assert.equal(visibility.projectedPointVisible(second.position), true)
  assert.equal(visibility.projectedPointVisible({ x: -100, y: -100 }), false)
  assert.equal(createBoneyardEnemyVisibility(bounds, {}, {}, []).projectedPointVisible(player.position), false)
})
