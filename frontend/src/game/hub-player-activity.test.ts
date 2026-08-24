import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  deriveHubPlayerActivityItems,
  hubPlayerActivities,
  hubPlayerActivityLabel,
  sameHubPlayerActivities,
} from './hub-player-activity.ts'

const CHARACTER: PlayerCharacterConfig = {
  discipline: 'arcane',
  displayName: 'Aurelia',
  element: 'fire',
}

const hubSceneSource = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const rendererSource = readFileSync(
  new URL('./renderer/hub-world-renderer.ts', import.meta.url),
  'utf8',
)
const layerSource = readFileSync(
  new URL('./renderer/hub-player-activity-layer.ts', import.meta.url),
  'utf8',
)

test('Hub activity labels and derivation include local and remote same-region players only', () => {
  const snapshot = createGameSnapshot(createGameSimulation({
    local: CHARACTER,
    occupied: { ...CHARACTER, displayName: 'Occupied' },
    paused: { ...CHARACTER, displayName: 'Paused' },
    remote: { ...CHARACTER, displayName: 'Remote' },
  }), 'local', {
    local: 'occupied',
    occupied: 'occupied',
    paused: 'paused',
  })
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const participants = {
    ...snapshot.world.participants,
    remote: {
      ...snapshot.world.participants.remote!,
      activity: 'paused' as const,
      region: 'library' as const,
    },
  }

  assert.equal(hubPlayerActivityLabel('paused'), 'Paused')
  assert.equal(hubPlayerActivityLabel('occupied'), 'Occupied')
  assert.deepEqual(
    deriveHubPlayerActivityItems(
      snapshot.players,
      participants,
      'courtyard',
    ).map(({ activity, playerId }) => ({ activity, playerId })),
    [
      { activity: 'occupied', playerId: 'local' },
      { activity: 'occupied', playerId: 'occupied' },
      { activity: 'paused', playerId: 'paused' },
    ],
  )
})

test('Hub activity maps compare all participant joins, removals, and state changes', () => {
  const first = { local: null, remote: 'paused' as const }
  assert.equal(sameHubPlayerActivities(first, { ...first }), true)
  assert.equal(sameHubPlayerActivities(first, { local: null, remote: 'occupied' }), false)
  assert.equal(sameHubPlayerActivities(first, { local: null }), false)

  const snapshot = createGameSnapshot(
    createGameSimulation({ local: CHARACTER, remote: CHARACTER }),
    'local',
    { remote: 'paused' },
  )
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  assert.deepEqual(hubPlayerActivities(snapshot.world.participants), first)
})

test('Hub card and post-world badge consume one replicated activity field', () => {
  assert.match(hubSceneSource, /data-profile-activity=\{activity\}/)
  assert.match(hubSceneSource, /hubPlayerActivityLabel\(activity\)/)
  assert.match(
    hubSceneSource,
    /const modalOpen = pickerOpen \|\| hubUiSurface !== null \|\| npcNoteboxOpen \|\| selectedPlayerId !== null\s*\|\| partySettingsOpen/,
  )
  assert.match(hubSceneSource, /onOccupiedChange\(modalOpen\)/)
  assert.match(rendererSource, /new HubPlayerActivityLayer\(\)/)
  assert.match(rendererSource, /deriveHubPlayerActivityItems\(/)
  assert.match(rendererSource, /hubActivityPlayerIds/)
  assert.match(layerSource, /activity === 'paused'/)
  assert.match(layerSource, /for \(const x of \[-4\.5, 0, 4\.5\]\)/)
})
