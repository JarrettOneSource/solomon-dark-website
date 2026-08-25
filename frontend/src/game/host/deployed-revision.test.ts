import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'

import { readDeployedRevision } from './deployed-revision.ts'

test('the production supervisor reads its revision from the immutable release', async () => {
  const releaseRoot = await mkdtemp(resolve(tmpdir(), 'solomon-release-revision-'))
  try {
    const revision = 'a'.repeat(40)
    await writeFile(resolve(releaseRoot, 'DEPLOYED_GIT_SHA'), `${revision}\n`)
    assert.equal(await readDeployedRevision(releaseRoot), revision)
  } finally {
    await rm(releaseRoot, { force: true, recursive: true })
  }
})

test('the production supervisor rejects an invalid release revision', async () => {
  const releaseRoot = await mkdtemp(resolve(tmpdir(), 'solomon-release-revision-'))
  try {
    await writeFile(resolve(releaseRoot, 'DEPLOYED_GIT_SHA'), 'main\n')
    await assert.rejects(
      readDeployedRevision(releaseRoot),
      /DEPLOYED_GIT_SHA must contain a full Git commit ID/,
    )
  } finally {
    await rm(releaseRoot, { force: true, recursive: true })
  }
})
