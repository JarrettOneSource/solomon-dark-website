import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'
import { createDoc } from '../src/editor/model.ts'

async function navigation(context, websiteBase, gameBase) {
  // Use the Website's real asset/glob transforms without opening a listener.
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, watch: null },
    define: {
      'import.meta.env.VITE_WEBSITE_BASE': JSON.stringify(websiteBase),
      'import.meta.env.VITE_GAME_ARTIFACT_BASE': JSON.stringify(gameBase),
    },
  })
  context.after(() => server.close())
  return server.ssrLoadModule('/src/editor/workshop-navigation.ts')
}

test('a shelf request keeps its actual draft and immediate Test mode', async context => {
  const { decodeWorkshopRequest, boneyardLibraryReturnUrl } = await navigation(context, '/site', '/game-stg')
  const doc = createDoc('The Back Forty')
  const request = { kind: 'open', doc, draftId: 'draft-one', savedAt: 123456, test: true }
  assert.deepEqual(decodeWorkshopRequest({ ...request,
    document: { format: 'sdr-boneyard-doc', version: 1, doc } }), request)
  assert.equal(boneyardLibraryReturnUrl(), '/game-stg/?dark-cloud=boneyards')
})

test('New is distinct from Edit and malformed handoffs are rejected', async context => {
  const { decodeWorkshopRequest, boneyardLibraryReturnUrl } = await navigation(context, '', '/game')
  assert.deepEqual(decodeWorkshopRequest({ kind: 'new' }), { kind: 'new' })
  assert.throws(() => decodeWorkshopRequest({ kind: 'open', test: true }), /could not be read/)
  assert.equal(boneyardLibraryReturnUrl(), '/game/?dark-cloud=boneyards')
})

test('stored requests cannot provide a return redirect', async context => {
  const { decodeWorkshopRequest, boneyardLibraryReturnUrl } = await navigation(context, '/site', '/game-stg')
  assert.deepEqual(decodeWorkshopRequest({ kind: 'new', returnTo: 'https://unrelated.test/' }), { kind: 'new' })
  assert.equal(boneyardLibraryReturnUrl(), '/game-stg/?dark-cloud=boneyards')
})
