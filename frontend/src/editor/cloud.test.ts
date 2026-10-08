import assert from 'node:assert/strict'
import test from 'node:test'

import { ApiError, type BoneyardDraft } from '../lib/api.ts'
import { cloudIdFor, saveDraftToCloud, setCloudId } from './cloud.ts'

const stored = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    removeItem: (key: string) => { stored.delete(key) },
    setItem: (key: string, value: string) => { stored.set(key, value) },
  },
})

const patch = { name: 'Moss Acre', document: { version: 1 } }

function draft(id: number, name: string): BoneyardDraft {
  const at = '2026-10-07T12:00:00.000Z'
  return { id, name, createdAt: at, updatedAt: at, documentSize: 0, compiledSize: null, document: null, compiledBoneyard: null }
}

function cloudDrafts(failUpdate?: (id: number) => Error | undefined) {
  const calls: string[] = []
  let nextId = 40
  return {
    calls,
    drafts: {
      create: async (name: string) => {
        calls.push(`create ${name}`)
        return draft(++nextId, name)
      },
      update: async (id: number, written: unknown) => {
        calls.push(`update ${id}`)
        assert.equal(written, patch)
        const failure = failUpdate?.(id)
        if (failure) throw failure
        return draft(id, patch.name)
      },
    },
  }
}

test('a draft without a cloud copy gets one and remembers it', async () => {
  stored.clear()
  const { calls, drafts } = cloudDrafts()
  assert.equal(await saveDraftToCloud(drafts, 'd-new', 'Moss Acre', patch), 41)
  assert.deepEqual(calls, ['create Moss Acre', 'update 41'])
  assert.equal(cloudIdFor('d-new'), 41)
})

test('a remembered cloud copy is updated in place', async () => {
  stored.clear()
  setCloudId('d-kept', 7)
  const { calls, drafts } = cloudDrafts()
  assert.equal(await saveDraftToCloud(drafts, 'd-kept', 'Moss Acre', patch), 7)
  assert.deepEqual(calls, ['update 7'])
})

test('a cloud copy deleted elsewhere is replaced instead of failing the save', async () => {
  stored.clear()
  setCloudId('d-gone', 7)
  const { calls, drafts } = cloudDrafts(id => id === 7 ? new ApiError(404, 'That Boneyard draft is not in your folio.') : undefined)
  assert.equal(await saveDraftToCloud(drafts, 'd-gone', 'Moss Acre', patch), 41)
  assert.deepEqual(calls, ['update 7', 'create Moss Acre', 'update 41'])
  assert.equal(cloudIdFor('d-gone'), 41)
})

test('other cloud failures surface and keep the remembered copy', async () => {
  stored.clear()
  setCloudId('d-busy', 7)
  const { calls, drafts } = cloudDrafts(() => new ApiError(503, 'The Annals are closed.'))
  await assert.rejects(saveDraftToCloud(drafts, 'd-busy', 'Moss Acre', patch), /The Annals are closed\./)
  assert.deepEqual(calls, ['update 7'])
  assert.equal(cloudIdFor('d-busy'), 7)
})

test('a new copy is remembered even when its first write fails', async () => {
  stored.clear()
  const { calls, drafts } = cloudDrafts(() => new ApiError(413, 'This draft is too large.'))
  await assert.rejects(saveDraftToCloud(drafts, 'd-large', 'Moss Acre', patch), /too large/)
  assert.deepEqual(calls, ['create Moss Acre', 'update 41'])
  assert.equal(cloudIdFor('d-large'), 41)
})
