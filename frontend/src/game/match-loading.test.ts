import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATCH_LOADING_PRESENTATION_DELAY_MS,
  MATCH_LOADING_STAGE_DEFINITIONS,
  advanceMatchLoading,
  beginMatchLoading,
  completeMatchLoading,
  shouldPresentMatchLoading,
} from './match-loading.ts'

test('retains every applicable loader stage after the browser lobby cutover', () => {
  assert.deepEqual(
    MATCH_LOADING_STAGE_DEFINITIONS.map(({ label, progress, stage }) => [
      stage,
      label,
      progress,
    ]),
    [
      ['connecting_transport', 'Waking the multiplayer transport...', 0.44],
      ['authenticating_session', 'Proving your sigil to the host...', 0.52],
      ['establishing_route', 'Opening the route...', 0.56],
      ['synchronizing_host_settings', "Receiving the host's settings...", 0.60],
      ['receiving_host_checkpoint', "Receiving the host's checkpoint...", 0.66],
      ['preparing_host', 'Preparing the host...', 0.66],
      ['receiving_run_plan', "Receiving the host's boneyard...", 0.70],
      ['preparing_boneyard', 'Preparing the boneyard...', 0.73],
      ['generating_boneyard', 'Raising the boneyard...', 0.77],
      ['serializing_boneyard', 'Sealing the boneyard...', 0.80],
      ['reading_boneyard', 'Loading the boneyard...', 0.83],
      ['materializing_world', 'Awakening the world...', 0.87],
      ['receiving_world_checkpoint', 'Receiving the living world...', 0.90],
      ['receiving_wave_checkpoint', "Aligning the host's wave...", 0.91],
      ['materializing_participants', 'Gathering the coven...', 0.92],
      ['waiting_for_participants', 'Waiting for the coven...', 0.95],
      ['confirming_participants', 'Binding the coven...', 0.98],
      ['gameplay_ready', 'Entering the boneyard...', 1.00],
    ],
  )
})

test('advances only to a strictly greater lifecycle value', () => {
  const creating = beginMatchLoading('hub', 'connecting_transport', 1_000)
  assert.equal(advanceMatchLoading(creating, 'connecting_transport'), creating)

  const authenticating = advanceMatchLoading(creating, 'authenticating_session')
  assert.notEqual(authenticating, creating)
  assert.equal(authenticating.flow, 'hub')
  assert.equal(authenticating.label, 'Proving your sigil to the host...')
  assert.equal(authenticating.progress, 0.52)
  assert.equal(authenticating.stage, 'authenticating_session')
  assert.equal(authenticating.startedAtMs, 1_000)
})

test('reveals after 150 ms without imposing a completion hold', () => {
  const loading = beginMatchLoading('boneyard', 'preparing_boneyard', 2_000)
  assert.equal(MATCH_LOADING_PRESENTATION_DELAY_MS, 150)
  assert.equal(shouldPresentMatchLoading(loading, 2_149), false)
  assert.equal(shouldPresentMatchLoading(loading, 2_150), true)

  const completed = completeMatchLoading(loading)
  assert.equal(completed.stage, 'gameplay_ready')
  assert.equal(completed.progress, 1)
  assert.equal(completed.startedAtMs, loading.startedAtMs)
})
