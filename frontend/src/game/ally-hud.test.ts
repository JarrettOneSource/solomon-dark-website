import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import type { ProtocolPlayerState } from './protocol/game-state.ts'
import {
  allyHudIdentityPresentation,
  allyHudRowsEqual,
  clampAllyHudHealthRatio,
  combineAllyHudRows,
  derivePlayerAllyHudRows,
  layoutNativeAllyName,
  NATIVE_ALLY_FONT,
  type AllyHudRow,
} from './ally-hud.ts'

const DEFAULT_PLAYER = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!

function player(displayName: string): ProtocolPlayerState {
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

test('ally HUD derives exact nonlocal lobby identities in stable player order', () => {
  const rows = derivePlayerAllyHudRows({
    'player-3': player('Vibia'),
    'player-1': player('Helvidius'),
    'player-2': player('Aurelia'),
  }, 'player-2')

  assert.deepEqual(rows, [
    {
      healthRatio: 1,
      id: 'player-1',
      identity: { kind: 'player', displayName: 'Helvidius' },
    },
    {
      healthRatio: 1,
      id: 'player-3',
      identity: { kind: 'player', displayName: 'Vibia' },
    },
  ])
})

test('ally HUD appends the explicit stock Golem presentation through the shared row seam', () => {
  const players = derivePlayerAllyHudRows({
    local: player('Local'),
    remote: player('Remote'),
  }, 'local')
  const golem: AllyHudRow = {
    healthRatio: 0.375,
    id: 'golem-7',
    identity: { kind: 'golem' },
  }

  assert.deepEqual(combineAllyHudRows(players, [golem]), [...players, golem])
  assert.deepEqual(allyHudIdentityPresentation(golem.identity), {
    accessibleName: 'Golem',
    visual: 'stock-golem',
  })
})

test('ally HUD clamps ratios without smoothing and compares semantic rows', () => {
  assert.equal(clampAllyHudHealthRatio(-1), 0)
  assert.equal(clampAllyHudHealthRatio(0.375), 0.375)
  assert.equal(clampAllyHudHealthRatio(2), 1)

  const first: AllyHudRow[] = [{
    healthRatio: 0.5,
    id: 'remote',
    identity: { kind: 'player', displayName: 'Remote' },
  }]
  assert.equal(allyHudRowsEqual(first, first.map((row) => ({
    ...row,
    identity: { ...row.identity },
  }))), true)
  assert.equal(allyHudRowsEqual(first, [{ ...first[0], healthRatio: 0.6 }]), false)
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
