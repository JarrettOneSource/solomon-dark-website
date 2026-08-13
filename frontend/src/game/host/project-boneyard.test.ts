import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import { projectBoneyard } from './project-boneyard.ts'

const storyFixture = new URL('../../../public/samples/story0.boneyard', import.meta.url)

test('projects explicit Fencepost selectors and omits the native sentinel', () => {
  const document = parseBoneyard(readFileSync(storyFixture))
  assert.ok(document.fences[0])
  document.fences[0] = {
    ...document.fences[0],
    startPostVariant: 4,
    endPostVariant: 0xffffffff,
  }

  const projected = projectBoneyard(document).fences[0]
  assert.equal(projected.startPostVariant, 4)
  assert.equal('endPostVariant' in projected, false)
})
