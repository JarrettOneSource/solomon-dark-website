import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { readGameSaveFileSelection } from './game-save-files.ts'
import { parseGameSaveDocument } from './game-save-contract.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
  retireGameSaveWizard,
} from './game-save-document.ts'

test('compatible future saves resume and retire without losing the profile', async () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({
      owner: { discipline: 'arcane', displayName: 'Version test', element: 'fire' },
    }),
  })
  const future = JSON.stringify({ ...JSON.parse(document), schemaVersion: 999 })
  const imported = await readGameSaveFileSelection([new File([future], 'save.json')])
  const currentImport = await readGameSaveFileSelection([new File([document], 'save.json')])
  assert.equal(imported.displayName, 'Version test')
  assert.deepEqual(
    restoreGameSaveDocument(imported.document).state,
    restoreGameSaveDocument(currentImport.document).state,
  )
  assert.deepEqual(restoreGameSaveDocument(future), restoreGameSaveDocument(document))
  assert.deepEqual(
    parseGameSaveDocument(retireGameSaveWizard(future)),
    parseGameSaveDocument(retireGameSaveWizard(document)),
  )
  assert.throws(() => restoreGameSaveDocument(JSON.stringify({
    ...JSON.parse(future), continuation: { simulation: {} },
  })), /game save/)
})
