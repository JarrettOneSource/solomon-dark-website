import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import {
  WORLD_NAMEPLATE_ELEMENT_ACCENTS,
  WORLD_NAMEPLATE_GEOMETRY,
  WORLD_NAMEPLATE_STYLE,
  deriveNativeWorldNameplateItems,
  nativeWorldNameplateHealthRatio,
  projectNativeWorldPoint,
  worldNameplateVisualLayout,
  type NativeWorldScreenTransform,
} from './native-world-nameplate.ts'

const DEFAULT_PLAYER = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!

function player(displayName: string, x = 100, y = 200): ProtocolPlayerState {
  return {
    config: {
      discipline: 'arcane',
      displayName,
      element: 'ether',
    },
    economy: DEFAULT_PLAYER.economy,
    footstepTick: 0,
    gaitDegrees: 0,
    headingIndex: 0,
    lighting: DEFAULT_PLAYER.lighting,
    position: { x, y },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
}

test('world nameplates exclude self, invalid entries, and off-scene players', () => {
  const remote = player('Remote', 110, 210)
  const zeroHealth = player('Zero', 120, 220)
  zeroHealth.progression = {
    ...zeroHealth.progression,
    currentHealth: 0,
  }
  const invalidHealth = player('Invalid', 130, 230)
  invalidHealth.progression = {
    ...invalidHealth.progression,
    maximumHealth: 0,
  }

  assert.deepEqual(
    deriveNativeWorldNameplateItems({
      local: player('Local'),
      remote,
      zeroHealth,
      invalidHealth,
      blank: player(''),
    }, 'local', (playerId) => playerId !== 'zeroHealth'),
    [{
      element: 'ether',
      healthRatio: 1,
      id: 'remote',
      name: 'Remote',
      position: { x: 110, y: 210 },
    }],
  )
})

test('world nameplates preserve a valid zero-health actor with an empty bar', () => {
  const zeroHealth = player('Zero')
  zeroHealth.progression = {
    ...zeroHealth.progression,
    currentHealth: 0,
    maximumHealth: 50,
  }

  assert.deepEqual(
    deriveNativeWorldNameplateItems({ local: player('Local'), zero: zeroHealth }, 'local'),
    [{
      element: 'ether',
      healthRatio: 0,
      id: 'zero',
      name: 'Zero',
      position: { x: 100, y: 200 },
    }],
  )
})

test('world nameplate health and width use native clamping and minimums', () => {
  assert.equal(nativeWorldNameplateHealthRatio(12.5, 50), 0.25)
  assert.equal(nativeWorldNameplateHealthRatio(-1, 50), 0)
  assert.equal(nativeWorldNameplateHealthRatio(100, 50), 1)
  assert.equal(nativeWorldNameplateHealthRatio(1, 0), null)
  const short = worldNameplateVisualLayout('Host')
  const long = worldNameplateVisualLayout('123456789')
  const spaced = worldNameplateVisualLayout('A B')
  assert.equal(short.width, WORLD_NAMEPLATE_STYLE.minimumWidth)
  assert.ok(long.width > short.width)
  assert.equal(spaced.width, WORLD_NAMEPLATE_STYLE.minimumWidth)
  for (const layout of [short, long, spaced]) {
    assert.ok(Math.abs(layout.glyphBounds.left + layout.glyphBounds.right) < 0.0001)
    assert.ok(layout.width >= layout.glyphBounds.right - layout.glyphBounds.left)
    assert.equal(layout.width % 2, 0, 'plate widths stay even so the frame lands on whole pixels')
  }
})

test('world nameplate names share one baseline centred in the name area above the rail', () => {
  const geometry = WORLD_NAMEPLATE_GEOMETRY
  assert.ok(geometry.plateTop < geometry.nameTop)
  assert.ok(geometry.nameBottom < geometry.railTop)
  assert.ok(geometry.railBottom < geometry.plateBottom)
  assert.equal(geometry.plateBottom - geometry.plateTop, WORLD_NAMEPLATE_STYLE.plateHeight)
  assert.equal(geometry.railBottom - geometry.railTop, WORLD_NAMEPLATE_STYLE.railHeight)
  for (const displayName of ['Basil', 'basil', 'BASIL', '123456789', 'j']) {
    const layout = worldNameplateVisualLayout(displayName)
    const capCenter = (layout.capBox.top + layout.capBox.bottom) / 2
    assert.ok(Math.abs(capCenter - geometry.nameCenterY) < 0.0001, displayName)
    assert.ok(layout.capBox.top >= geometry.nameTop + 1, displayName)
    assert.ok(layout.capBox.bottom <= geometry.nameBottom, displayName)
    assert.equal(layout.glyphOffsetY, worldNameplateVisualLayout('Other').glyphOffsetY)
  }
})

test('world nameplates carry the wizard element and every element has an accent', () => {
  const fire = player('Ember')
  fire.config = { ...fire.config, element: 'fire' }
  const [item] = deriveNativeWorldNameplateItems({ local: player('Local'), fire }, 'local')
  assert.equal(item?.element, 'fire')
  for (const element of ['air', 'earth', 'ether', 'fire', 'water'] as const) {
    const accent = WORLD_NAMEPLATE_ELEMENT_ACCENTS[element]
    assert.ok(Number.isInteger(accent) && accent >= 0 && accent <= 0xffffff, element)
  }
  assert.equal(new Set(Object.values(WORLD_NAMEPLATE_ELEMENT_ACCENTS)).size, 5)
})

test('world nameplate projection uses the post-world screen transform', () => {
  const transform: NativeWorldScreenTransform = {
    position: { x: 100, y: 50 },
    scale: 1.2,
  }

  assert.deepEqual(
    projectNativeWorldPoint(
      { x: 10, y: 20 },
      transform,
      { width: 1600, height: 900 },
    ),
    { x: 112, y: 74 },
  )
  assert.equal(
    projectNativeWorldPoint(
      { x: -100, y: 20 },
      transform,
      { width: 1600, height: 900 },
    ),
    null,
  )
})
