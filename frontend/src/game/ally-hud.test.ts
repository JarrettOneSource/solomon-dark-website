import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import type { ProtocolPlayerState } from './protocol/game-state.ts'
import {
  allyHudAccessibleName,
  allyHudAccessibleStatus,
  allyHudRowsEqual,
  clampAllyHudHealthRatio,
  combineAllyHudRows,
  deriveGolemAllyHudRows,
  derivePlayerAllyHudRows,
  layoutNativeAllyName,
  NATIVE_ALLY_FONT,
  type AllyHudRow,
} from './ally-hud.ts'

const DEFAULT_PLAYER = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!

function player(displayName: string): ProtocolPlayerState {
  return {
    belt: DEFAULT_PLAYER.belt,
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
    movementScale: DEFAULT_PLAYER.movementScale,
    position: { x: 0, y: 0 },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
}

test('ally HUD derives remote health from authoritative player progression', () => {
  const remote = player('Remote')
  const rows = derivePlayerAllyHudRows({
    local: player('Local'),
    remote: {
      ...remote,
      progression: {
        ...remote.progression,
        currentHealth: 12.5,
        maximumHealth: 50,
      },
    },
  }, 'local')

  assert.equal(rows[0]?.healthRatio, 0.25)
})

test('ally HUD retains dead party players with a red-tint state', () => {
  const remote = player('Remote')
  remote.progression = {
    ...remote.progression,
    currentHealth: 0,
    lifeState: 'dying',
  }

  assert.deepEqual(derivePlayerAllyHudRows({ local: player('Local'), remote }, 'local'), [{
    connected: true,
    dead: true,
    healthRatio: 0,
    id: 'remote',
    identity: { kind: 'player', displayName: 'Remote', element: 'ether' },
  }])
})

test('ally HUD retains disconnected members and composes disconnect with death', () => {
  const local = player('Local')
  const rows = derivePlayerAllyHudRows({ local }, 'local', [
    {
      connected: false,
      currentHealth: 25,
      displayName: 'Disconnected',
      element: 'water',
      lifeState: 'alive',
      maximumHealth: 50,
      playerId: 'offline-alive',
    },
    {
      connected: false,
      currentHealth: 0,
      displayName: 'Fallen',
      element: 'fire',
      lifeState: 'spectating',
      maximumHealth: 75,
      playerId: 'offline-dead',
    },
  ])

  assert.deepEqual(rows, [
    {
      connected: false,
      dead: false,
      healthRatio: 0.5,
      id: 'offline-alive',
      identity: { kind: 'player', displayName: 'Disconnected', element: 'water' },
    },
    {
      connected: false,
      dead: true,
      healthRatio: 0,
      id: 'offline-dead',
      identity: { kind: 'player', displayName: 'Fallen', element: 'fire' },
    },
  ])
})

test('ally HUD derives exact nonlocal party identities in stable player order', () => {
  const rows = derivePlayerAllyHudRows({
    'player-3': player('Vibia'),
    'player-1': player('Helvidius'),
    'player-2': player('Aurelia'),
  }, 'player-2')

  assert.deepEqual(rows, [
    {
      connected: true,
      dead: false,
      healthRatio: 1,
      id: 'player-1',
      identity: { kind: 'player', displayName: 'Helvidius', element: 'ether' },
    },
    {
      connected: true,
      dead: false,
      healthRatio: 1,
      id: 'player-3',
      identity: { kind: 'player', displayName: 'Vibia', element: 'ether' },
    },
  ])
})

test('ally HUD excludes visible shared-Hub residents outside the local party', () => {
  const local = player('Local')
  const party = player('Party Member')
  const rows = derivePlayerAllyHudRows({
    local,
    party,
    stranger: player('Hub Stranger'),
  }, 'local', [
    {
      connected: true,
      currentHealth: local.progression.currentHealth,
      displayName: local.config.displayName,
      element: local.config.element,
      lifeState: local.progression.lifeState,
      maximumHealth: local.progression.maximumHealth,
      playerId: 'local',
    },
    {
      connected: true,
      currentHealth: party.progression.currentHealth,
      displayName: party.config.displayName,
      element: party.config.element,
      lifeState: party.progression.lifeState,
      maximumHealth: party.progression.maximumHealth,
      playerId: 'party',
    },
  ])

  assert.deepEqual(rows.map(({ id }) => id), ['party'])
})

test('ally HUD appends the explicit stock Golem presentation through the shared row seam', () => {
  const players = derivePlayerAllyHudRows({
    local: player('Local'),
    remote: player('Remote'),
  }, 'local')
  const golem: AllyHudRow = {
    connected: true,
    dead: false,
    healthRatio: 0.375,
    id: 'golem-7',
    identity: { kind: 'golem' },
  }

  assert.deepEqual(combineAllyHudRows(players, [golem]), [...players, golem])
  assert.equal(allyHudAccessibleName(golem.identity), 'Golem')
  assert.equal(
    allyHudAccessibleName({ kind: 'player', displayName: 'Remote', element: 'fire' }),
    'Remote',
  )
  assert.equal(allyHudAccessibleStatus({
    connected: false,
    dead: true,
    healthRatio: 0,
    id: 'remote',
    identity: { kind: 'player', displayName: 'Remote', element: 'fire' },
  }), 'Remote, dead and disconnected')
})

test('ally HUD derives every live in-world Golem row in stable actor order', () => {
  const health = (currentHealth: number, maximumHealth = 100) => ({
    currentHealth,
    maximumHealth,
  })
  const rows = deriveGolemAllyHudRows([
    { golem: health(25), id: 9, kind: 'golem', worldKey: 'boneyard:run' },
    { golem: health(60), id: 2, kind: 'golem', worldKey: 'boneyard:run' },
    { golem: health(80), id: 1, kind: 'golem', worldKey: 'boneyard:other' },
    { golem: health(0), id: 3, kind: 'golem-death', worldKey: 'boneyard:run' },
  ], 'boneyard:run')

  assert.deepEqual(rows, [
    { connected: true, dead: false, healthRatio: 0.6, id: 'golem:2', identity: { kind: 'golem' } },
    { connected: true, dead: false, healthRatio: 0.25, id: 'golem:9', identity: { kind: 'golem' } },
  ])
})

test('ally HUD clamps ratios without smoothing and compares semantic rows', () => {
  assert.equal(clampAllyHudHealthRatio(-1), 0)
  assert.equal(clampAllyHudHealthRatio(0.375), 0.375)
  assert.equal(clampAllyHudHealthRatio(2), 1)

  const first: AllyHudRow[] = [{
    connected: true,
    dead: false,
    healthRatio: 0.5,
    id: 'remote',
    identity: { kind: 'player', displayName: 'Remote', element: 'ether' },
  }]
  assert.equal(allyHudRowsEqual(first, first.map((row) => ({
    ...row,
    identity: { ...row.identity },
  }))), true)
  assert.equal(allyHudRowsEqual(first, [{ ...first[0], healthRatio: 0.6 }]), false)
  assert.equal(allyHudRowsEqual(first, [{ ...first[0], connected: false }]), false)
  assert.equal(allyHudRowsEqual(first, [{ ...first[0], dead: true }]), false)
  assert.equal(allyHudRowsEqual(first, [{
    ...first[0],
    identity: { kind: 'player', displayName: 'Remote', element: 'fire' },
  }]), false)
})

test('ally HUD lays out native quarter-scale bitmap glyphs with bundle kerning', () => {
  assert.equal(NATIVE_ALLY_FONT.glyphCount, 67)
  assert.equal(NATIVE_ALLY_FONT.kerningCount, 1_043)
  assert.equal(NATIVE_ALLY_FONT.glyphs.A.record, 391)
  assert.equal(NATIVE_ALLY_FONT.kerning['65:66'], 3)

  const layout = layoutNativeAllyName('AB')
  assert.equal(layout.advance, 9)
  assert.deepEqual(layout.glyphs.map((glyph) => ({
    char: glyph.char,
    height: glyph.height,
    left: glyph.left,
    top: glyph.top,
    width: glyph.width,
  })), [
    { char: 'A', height: 6.5, left: -0.25, top: -4.75, width: 6 },
    { char: 'B', height: 6.75, left: 5, top: -5, width: 4 },
  ])
})

test('ally HUD font layout can reuse native group-6 metrics at world half scale', () => {
  const layout = layoutNativeAllyName('AB', 0.5)
  assert.equal(layout.advance, 18)
  assert.deepEqual(layout.glyphs.map((glyph) => ({
    height: glyph.height,
    left: glyph.left,
    top: glyph.top,
    width: glyph.width,
  })), [
    { height: 13, left: -0.5, top: -9.5, width: 12 },
    { height: 13.5, left: 10, top: -10, width: 8 },
  ])
})
